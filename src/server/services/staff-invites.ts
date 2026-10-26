import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { BRAND } from "@/config/brand";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import type { User } from "../repositories/users";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { addStaffMember, getVenueRecord, isManagerRole, venueRole, type VenueRecord } from "../repositories/venues";
import { renderEmail } from "./email-template";
import { sendMail } from "./mailer";
import { completePairing, createPairing, currentStaffDevice } from "./staff";

/**
 * Staff logins. An owner invites someone by email; the link adds them to the
 * venue as "staff" once they've signed in (or signed up). Staff can't open the
 * dashboard: signing in just lets them turn the phone they're holding into a
 * till device, the same as the owner's pairing link.
 */

const INVITE_DAYS = 7;
const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Invites one venue can send in a day: plenty for a café, too few to spam with. */
const MAX_INVITES_PER_DAY = 20;

export async function createStaffInvite(venue: VenueRecord, inviter: User, rawEmail: string, origin: string): Promise<{ url: string }> {
  // These emails go out from our domain to any address, so the sender must have proved theirs.
  if (!inviter.emailVerified) throw new ServiceError(403, "Confirm your own email address first (check your inbox), then invite staff.");
  const email = normaliseEmail(rawEmail);
  if (!isPlausibleEmail(email)) throw new ServiceError(400, "Enter the staff member's email address");
  const today = ((await (await getDb()).get("SELECT COUNT(*) AS n FROM staff_invites WHERE venue_id = ? AND created_at >= now() - INTERVAL '1 day'", venue.id)) as { n: number }).n;
  if (today >= MAX_INVITES_PER_DAY) throw new ServiceError(429, "That's a lot of invites for one day. Try again tomorrow.");
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  (await (await getDb()).run("INSERT INTO staff_invites (id, venue_id, email, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)", digest(token), venue.id, email, inviter.id, expiresAt));
  const url = `${origin}/staff/join?t=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: `You're invited to the till at ${venue.config.name.slice(0, 60)}`,
    fromName: venue.config.name,
    ...renderEmail({
      brand: venue.config.name,
      preheader: `Use the till at ${venue.config.name} to stamp cards and give out rewards.`,
      heading: "You're invited to the till",
      paragraphs: [
        `${venue.config.name} has invited you to use its till on ${BRAND.name}.`,
        "Open the link on the phone or tablet you'll use behind the counter, then sign in or create a free account.",
      ],
      button: { label: "Join the till", url },
      notes: [`The link works for ${INVITE_DAYS} days. Staff accounts can stamp cards and give out rewards, nothing else.`],
      footer: [`${venue.config.name} · via ${BRAND.name}`],
    }),
  });
  return { url };
}

/** The venue an unused invite is for, so the sign-up page can say "Join the till at …". Null for a used, expired or unknown link. */
export async function inviteVenueName(token: string): Promise<string | null> {
  const invite = (await (await getDb()).get("SELECT venue_id, expires_at, used_at FROM staff_invites WHERE id = ?", digest(token))) as
    | { venue_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!invite || invite.used_at || Date.parse(invite.expires_at) <= Date.now()) return null;
  return (await getVenueRecord(invite.venue_id))?.config.name ?? null;
}

/** Uses an invite for this signed-in user. Returns the venue id, or null for a used, expired or unknown link. */
export async function acceptStaffInvite(token: string, user: User): Promise<string | null> {
  return await transaction(async (db) => {
    const invite = (await db.get("SELECT venue_id, expires_at, used_at FROM staff_invites WHERE id = ?", digest(token))) as
      | { venue_id: string; expires_at: string; used_at: string | null }
      | undefined;
    if (!invite || invite.used_at || Date.parse(invite.expires_at) <= Date.now()) return null;
    (await db.run("UPDATE staff_invites SET used_at = now() WHERE id = ?", digest(token)));
    await addStaffMember(invite.venue_id, user.id);
    return invite.venue_id;
  });
}

/**
 * Turns the browser a staff member (or owner) is signed in on into a till
 * device for the venue. Throws for anyone without a membership there.
 */
export async function openTillForUser(user: User, venueId: string): Promise<void> {
  const role = await venueRole(user.id, venueId);
  if (role !== "staff" && !isManagerRole(role)) throw new ServiceError(404, "Venue not found");
  // Already a till for this venue: don't add a duplicate to the owner's device list.
  if ((await currentStaffDevice())?.venueId === venueId) return;
  const { token } = await createPairing(venueId, `${user.name || user.email.split("@")[0]}'s login`, user.id);
  if (!(await completePairing(token))) throw new ServiceError(500, "Couldn't open the till, please try again");
}
