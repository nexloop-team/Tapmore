import "server-only";
import { encryptionConfigured } from "../crypto";
import { ServiceError } from "../http";

/**
 * Google Business Profile, for review replies. A café owner connects once
 * (OAuth, `business.manage`); Tapmore keeps the refresh token sealed and
 * uses short-lived access tokens to read reviews and post the owner's
 * replies, which Google shows as "Response from the owner".
 *
 * Tapmore's own OAuth client (GOOGLE_OAUTH_CLIENT_ID/SECRET) does the
 * asking: owners never touch Google Cloud. Plain fetch, like billing.ts.
 */

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_API = "https://mybusiness.googleapis.com/v4";
const NOTIFICATIONS_API = "https://mybusinessnotifications.googleapis.com/v1";
const TIMEOUT_MS = 20_000;

/** Every key the feature needs: without them the Reviews page and nav item stay hidden. */
export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() && encryptionConfigured();
}

/** The owner took Tapmore's access away (or changed their password): they need to connect again. */
export class GoogleAccessRevoked extends Error {}

export function callbackUrl(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    // A refresh token, every time, so a reconnect always leaves a working one.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "", ...body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ServiceError(503, "We couldn't reach Google just now. Please try again.");
  }
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (json.error === "invalid_grant") throw new GoogleAccessRevoked(json.error_description ?? "invalid_grant");
  if (!response.ok || !json.access_token) {
    console.error(`[google] token ${response.status}`, json.error, json.error_description);
    throw new ServiceError(502, "Google didn't accept the connection. Please try again.");
  }
  return json;
}

/** The one-time code from the consent screen, for tokens. The refresh token is what Tapmore keeps. */
export async function exchangeCode(origin: string, code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const json = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: callbackUrl(origin) });
  if (!json.refresh_token) throw new ServiceError(502, "Google didn't give Tapmore lasting access. Please connect again.");
  return { accessToken: json.access_token!, refreshToken: json.refresh_token, expiresIn: json.expires_in ?? 3600, scope: json.scope ?? "" };
}

/** Access tokens last an hour: one per refresh token, reused until a minute before it ends. */
const accessTokens = new Map<string, { token: string; expiresAt: number }>();

export async function accessToken(refreshToken: string): Promise<string> {
  const cached = accessTokens.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const json = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  accessTokens.set(refreshToken, { token: json.access_token!, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token!;
}

/** Best effort: disconnecting in Tapmore also takes the access back on Google's side. */
export async function revoke(refreshToken: string): Promise<void> {
  accessTokens.delete(refreshToken);
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    console.error("[google] revoke failed", error);
  }
}

/** One API call with the owner's access. A 401 refreshes the token once and tries again. */
async function call<T>(refreshToken: string, method: "GET" | "PUT" | "PATCH", url: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(refreshToken);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ServiceError(503, "We couldn't reach Google just now. Please try again.");
    }
    if (response.status === 401 && attempt === 0) {
      accessTokens.delete(refreshToken);
      continue;
    }
    const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
    if (response.ok) return json;
    console.error(`[google] ${method} ${url.replace(/\?.*$/, "")} ${response.status}`, json.error?.message?.slice(0, 300));
    if (response.status === 403) throw new ServiceError(403, "Google says this account can't manage that Business Profile.");
    if (response.status === 404) throw new ServiceError(404, "Google couldn't find that Business Profile or review.");
    if (response.status === 429) throw new ServiceError(503, "Google is busy right now. Please try again in a minute.");
    throw new ServiceError(502, "Google didn't respond as expected. Please try again.");
  }
  throw new ServiceError(502, "Google didn't accept Tapmore's access. Please connect again.");
}

export interface GoogleAccount {
  /** "accounts/123" */
  name: string;
  accountName?: string;
}

export interface GoogleLocation {
  /** "locations/456" */
  name: string;
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string };
  /** newReviewUri is the profile's "Ask for reviews" link: the one guests use to leave a review. */
  metadata?: { newReviewUri?: string };
}

export async function listAccounts(refreshToken: string): Promise<GoogleAccount[]> {
  const json = await call<{ accounts?: GoogleAccount[] }>(refreshToken, "GET", `${ACCOUNTS_API}/accounts?pageSize=20`);
  return json.accounts ?? [];
}

export async function listLocations(refreshToken: string, account: string): Promise<GoogleLocation[]> {
  const json = await call<{ locations?: GoogleLocation[] }>(refreshToken, "GET", `${INFO_API}/${account}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100`);
  return json.locations ?? [];
}

export interface GoogleReview {
  /** "accounts/1/locations/2/reviews/abc" */
  name: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE" | "STAR_RATING_UNSPECIFIED";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const starsOf = (review: GoogleReview): number => STARS[review.starRating ?? ""] ?? 0;

/** The v4 path a location's reviews live under: "accounts/1/locations/2". */
export const reviewsParent = (account: string, location: string): string => `${account}/${location}`;

/** Newest first, up to `max` reviews (Google pages them 50 at a time). */
export async function listReviews(refreshToken: string, parent: string, max = 200): Promise<GoogleReview[]> {
  const reviews: GoogleReview[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "50", orderBy: "updateTime desc", ...(pageToken ? { pageToken } : {}) });
    const json = await call<{ reviews?: GoogleReview[]; nextPageToken?: string }>(refreshToken, "GET", `${REVIEWS_API}/${parent}/reviews?${query}`);
    reviews.push(...(json.reviews ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken && reviews.length < max);
  return reviews.slice(0, max);
}

/** Posts (or replaces) the owner's reply. */
export async function putReply(refreshToken: string, reviewName: string, comment: string): Promise<{ comment: string; updateTime: string }> {
  return await call(refreshToken, "PUT", `${REVIEWS_API}/${reviewName}/reply`, { comment });
}

/** Asks Google to push NEW_REVIEW / UPDATED_REVIEW for this account to Tapmore's Pub/Sub topic. */
export async function enableReviewAlerts(refreshToken: string, account: string): Promise<void> {
  const topic = process.env.GOOGLE_PUBSUB_TOPIC?.trim();
  if (!topic) return;
  await call(refreshToken, "PATCH", `${NOTIFICATIONS_API}/${account}/notificationSetting?updateMask=notificationTypes,pubsubTopic`, {
    name: `${account}/notificationSetting`,
    pubsubTopic: topic,
    notificationTypes: ["NEW_REVIEW", "UPDATED_REVIEW"],
  });
}
