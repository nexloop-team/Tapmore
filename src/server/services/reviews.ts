import "server-only";
import { BRAND } from "@/config/brand";
import { consumeAuthToken, createAuthToken } from "../auth/session";
import { open, seal } from "../crypto";
import { ServiceError } from "../http";
import { appOrigin } from "../origin";
import {
  deleteConnection,
  getConnection,
  getStoredReview,
  linkLocation,
  markConnection,
  markReplied,
  markSynced,
  saveConnection,
  saveDraft,
  saveFromGoogle,
  setReviewState,
  venuesForLocation,
  type GoogleConnection,
  type StoredReview,
} from "../repositories/google-reviews";
import type { User } from "../repositories/users";
import { venueHasAccess } from "../repositories/subscriptions";
import { getVenueRecord, getVenueSettings, isManagerRole, venueOwnerEmails, venueRole } from "../repositories/venues";
import { aiConfigured, draftReviewReply } from "./ai";
import {
  authUrl,
  enableReviewAlerts,
  exchangeCode,
  GOOGLE_SCOPE,
  GoogleAccessRevoked,
  googleConfigured,
  listAccounts,
  listLocations,
  listReviews,
  putReply,
  reviewsParent,
  revoke,
  starsOf,
  type GoogleReview,
} from "./google";
import { sendMail } from "./mailer";

/**
 * Google review replies. The rules:
 *  - Connecting imports the reviews already there, without replying to any.
 *  - A new review gets an AI reply posted at once when the owner has
 *    auto-reply on for its stars (4-5★ on by default, 1-3★ off); anything
 *    else waits as a draft for the owner.
 *  - Nothing is drafted or posted while the venue's subscription is off.
 *  - Disconnecting takes the access back and deletes everything read from Google.
 */

const STATE_SEPARATOR = "~";
const STATE_MINUTES = 15;
const MAX_REPLY = 1500;

async function requireManager(user: User, venueId: string) {
  if (!isManagerRole(await venueRole(user.id, venueId))) throw new ServiceError(404, "Venue not found");
}

/** Google's consent page for this venue. The state ties Google's answer to this user and venue. */
export async function startConnect(user: User, venueId: string, origin: string): Promise<string> {
  if (!googleConfigured()) throw new ServiceError(503, "Google reviews aren't set up on this server yet");
  await requireManager(user, venueId);
  const token = await createAuthToken(user.id, "google_connect", STATE_MINUTES);
  return authUrl(origin, `${token}${STATE_SEPARATOR}${venueId}`);
}

/** Google's redirect back: keep the access, then link the location if there's only one. Returns the venue id. */
export async function completeConnect(user: User, code: string, state: string, origin: string): Promise<string> {
  const [token, venueId] = state.split(STATE_SEPARATOR);
  const userId = token ? await consumeAuthToken(token, "google_connect") : null;
  if (!userId || userId !== user.id || !venueId) throw new ServiceError(400, "That Google connection expired. Please try again.");
  await requireManager(user, venueId);
  const tokens = await exchangeCode(origin, code);
  // The owner can untick the permission on Google's screen.
  if (!tokens.scope.split(" ").includes(GOOGLE_SCOPE)) {
    await revoke(tokens.refreshToken);
    throw new ServiceError(400, "Tapmore needs permission to manage your reviews. Please connect again and allow it.");
  }
  await saveConnection(venueId, seal(tokens.refreshToken), user.id);
  const choices = await locationChoices(venueId);
  if (choices.length === 1) await chooseLocation(venueId, choices[0].account, choices[0].location);
  return venueId;
}

export interface LocationChoice {
  account: string;
  location: string;
  title: string;
  address: string;
}

/** Every Business Profile the connected Google account manages, for the owner to pick theirs. */
export async function locationChoices(venueId: string): Promise<LocationChoice[]> {
  const connection = await getConnection(venueId);
  if (!connection) return [];
  const refresh = open(connection.refreshTokenEnc);
  const choices: LocationChoice[] = [];
  for (const account of (await listAccounts(refresh)).slice(0, 10)) {
    for (const location of await listLocations(refresh, account.name)) {
      choices.push({
        account: account.name,
        location: location.name,
        title: location.title || "Untitled business",
        address: [...(location.storefrontAddress?.addressLines ?? []), location.storefrontAddress?.locality].filter(Boolean).join(", "),
      });
    }
  }
  return choices;
}

/** Links one of the account's locations, turns on Google's new-review alerts, and imports what's there. */
export async function chooseLocation(venueId: string, account: string, location: string) {
  const choice = (await locationChoices(venueId)).find((c) => c.account === account && c.location === location);
  if (!choice) throw new ServiceError(400, "That Business Profile isn't on the connected Google account");
  await linkLocation(venueId, account, location, choice.title);
  const connection = (await getConnection(venueId))!;
  try {
    await enableReviewAlerts(open(connection.refreshTokenEnc), account);
  } catch (error) {
    // The daily check still finds new reviews; alerts only make it faster.
    console.error("[reviews] couldn't turn on Google alerts", error);
  }
  await syncVenue(venueId, { imported: true });
}

/** Takes the access back on Google's side and keeps nothing read from it. */
export async function disconnect(venueId: string) {
  const connection = await getConnection(venueId);
  if (!connection) return;
  try {
    await revoke(open(connection.refreshTokenEnc));
  } catch (error) {
    console.error("[reviews] revoke failed", error);
  }
  await deleteConnection(venueId);
}

function firstName(review: GoogleReview): string | null {
  if (review.reviewer?.isAnonymous) return null;
  return review.reviewer?.displayName?.trim().split(/\s+/)[0] || null;
}

/** The access stopped working: say so on the page and to the owners, once. */
async function accessLost(venueId: string, connection: GoogleConnection) {
  if (connection.status === "revoked") return;
  await markConnection(venueId, "revoked", "Google access was removed or expired");
  const venue = await getVenueRecord(venueId);
  if (!venue) return;
  for (const to of await venueOwnerEmails(venueId)) {
    await sendMail({
      to,
      subject: `Reconnect Google for ${venue.config.name}`,
      text: [
        "Hi,",
        "",
        `Tapmore can no longer read or reply to ${venue.config.name}'s Google reviews. This happens when the Google account's access is removed or its password changes.`,
        "",
        "Connect it again here (it takes a few seconds):",
        `${appOrigin()}/dashboard/${venueId}/reviews`,
        "",
        BRAND.name,
      ].join("\n"),
    });
  }
}

/** Reads the location's reviews and acts on new ones. `imported`: the first read after connecting, which replies to nothing. */
export async function syncVenue(venueId: string, options: { imported?: boolean } = {}): Promise<{ added: number; posted: number }> {
  const connection = await getConnection(venueId);
  if (!connection || connection.status !== "active" || !connection.accountName || !connection.locationName) return { added: 0, posted: 0 };
  let reviews: GoogleReview[];
  try {
    reviews = await listReviews(open(connection.refreshTokenEnc), reviewsParent(connection.accountName, connection.locationName));
  } catch (error) {
    if (error instanceof GoogleAccessRevoked) {
      await accessLost(venueId, connection);
      return { added: 0, posted: 0 };
    }
    await markConnection(venueId, "active", error instanceof Error ? error.message.slice(0, 200) : "Couldn't read reviews");
    throw error;
  }
  const venue = await getVenueRecord(venueId);
  const settings = (await getVenueSettings(venueId)).reviews;
  const live = !options.imported && !!venue && (await venueHasAccess(venueId));
  let added = 0;
  let posted = 0;
  for (const review of reviews) {
    const { review: stored, isNew } = await saveFromGoogle(
      venueId,
      {
        id: review.name,
        reviewerName: review.reviewer?.isAnonymous ? null : (review.reviewer?.displayName ?? null),
        stars: starsOf(review),
        comment: review.comment?.trim() || null,
        reviewTime: review.createTime,
        updateTime: review.updateTime,
        replyText: review.reviewReply?.comment ?? null,
        replyTime: review.reviewReply?.updateTime ?? null,
      },
      !!options.imported,
    );
    if (!isNew) continue;
    added += 1;
    if (!live || stored.state === "replied") continue;
    if (await respond(venueId, venue!.config.name, stored, firstName(review), settings, connection)) posted += 1;
  }
  await markSynced(venueId);
  return { added, posted };
}

/** A new review: post the AI reply when auto-reply is on for its stars, or leave it as a draft. True when posted. */
async function respond(
  venueId: string,
  venueName: string,
  review: StoredReview,
  reviewerFirstName: string | null,
  settings: { autoReply: boolean; autoReplyCritical: boolean; signOff: string },
  connection: GoogleConnection,
): Promise<boolean> {
  let draft: string | null = null;
  if (aiConfigured()) {
    try {
      draft = await draftReviewReply({ id: venueId, name: venueName }, { stars: review.stars, text: review.comment, reviewerFirstName }, settings.signOff);
    } catch (error) {
      console.error("[reviews] draft failed", error);
    }
  }
  // A review with no star rating always waits for the owner.
  const auto = review.stars >= 4 ? settings.autoReply : review.stars >= 1 && settings.autoReplyCritical;
  if (draft && auto) {
    try {
      const result = await putReply(open(connection.refreshTokenEnc), review.id, draft);
      await markReplied(venueId, review.id, result.comment || draft, result.updateTime || new Date().toISOString(), "auto");
      return true;
    } catch (error) {
      console.error("[reviews] auto-reply failed", error);
      await saveDraft(venueId, review.id, draft, "failed");
      return false;
    }
  }
  await saveDraft(venueId, review.id, draft ?? "", "awaiting");
  return false;
}

async function requireLiveConnection(venueId: string): Promise<GoogleConnection> {
  const connection = await getConnection(venueId);
  if (!connection || connection.status !== "active") throw new ServiceError(409, "Connect Google first");
  return connection;
}

/** The owner's reply (a draft as written or edited, or a change to one already posted). */
export async function postReply(venueId: string, reviewId: string, text: string, user: User): Promise<StoredReview> {
  const connection = await requireLiveConnection(venueId);
  const review = await getStoredReview(venueId, reviewId);
  if (!review) throw new ServiceError(404, "Review not found");
  const comment = text.trim();
  if (!comment) throw new ServiceError(400, "Write a reply first");
  if (comment.length > MAX_REPLY) throw new ServiceError(400, `Keep replies under ${MAX_REPLY} characters`);
  if (!(await venueHasAccess(venueId))) throw new ServiceError(402, "Your subscription has ended. Renew it on the Billing page to reply.");
  try {
    const result = await putReply(open(connection.refreshTokenEnc), review.id, comment);
    await markReplied(venueId, review.id, result.comment || comment, result.updateTime || new Date().toISOString(), user.id);
  } catch (error) {
    if (error instanceof GoogleAccessRevoked) {
      await accessLost(venueId, connection);
      throw new ServiceError(409, "Google access was removed. Connect Google again to reply.");
    }
    throw error;
  }
  return (await getStoredReview(venueId, review.id))!;
}

/** A fresh AI draft for a review still waiting for a reply. */
export async function redraft(venueId: string, reviewId: string): Promise<StoredReview> {
  await requireLiveConnection(venueId);
  const review = await getStoredReview(venueId, reviewId);
  if (!review) throw new ServiceError(404, "Review not found");
  if (!(await venueHasAccess(venueId))) throw new ServiceError(402, "Your subscription has ended. Renew it on the Billing page to use this.");
  const venue = await getVenueRecord(venueId);
  const settings = (await getVenueSettings(venueId)).reviews;
  const first = review.reviewerName?.trim().split(/\s+/)[0] ?? null;
  const draft = await draftReviewReply({ id: venueId, name: venue?.config.name ?? "" }, { stars: review.stars, text: review.comment, reviewerFirstName: first }, settings.signOff);
  await saveDraft(venueId, review.id, draft, review.state === "replied" ? "replied" : "awaiting");
  return (await getStoredReview(venueId, review.id))!;
}

/** The owner decided not to reply: it leaves the "Needs reply" list. */
export async function skipReview(venueId: string, reviewId: string): Promise<void> {
  const review = await getStoredReview(venueId, reviewId);
  if (!review) throw new ServiceError(404, "Review not found");
  if (review.state !== "replied") await setReviewState(venueId, review.id, "skipped");
}

/** Google's Pub/Sub push: `{type, location: "accounts/1/locations/2", review}`. Syncs the venues on that location. */
export async function handleGoogleAlert(data: unknown): Promise<number> {
  const location = typeof data === "object" && data && "location" in data && typeof (data as { location: unknown }).location === "string" ? (data as { location: string }).location : null;
  if (!location) return 0;
  const venues = await venuesForLocation(location);
  for (const venueId of venues) {
    try {
      await syncVenue(venueId);
    } catch (error) {
      console.error("[reviews] alert sync failed", venueId, error);
    }
  }
  return venues.length;
}
