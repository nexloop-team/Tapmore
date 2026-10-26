import "server-only";
import { getDb } from "../db";

/** A venue's link to its Google Business Profile. */
export interface GoogleConnection {
  venueId: string;
  /** "accounts/123" */
  accountName: string | null;
  /** "locations/456" */
  locationName: string | null;
  locationTitle: string | null;
  /** Sealed with crypto.ts; never leaves the server. */
  refreshTokenEnc: string;
  connectedBy: string | null;
  connectedAt: string;
  status: "choose_location" | "active" | "revoked";
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface ConnectionRow {
  venue_id: string;
  account_name: string | null;
  location_name: string | null;
  location_title: string | null;
  refresh_token_enc: string;
  connected_by: string | null;
  connected_at: string;
  status: GoogleConnection["status"];
  last_synced_at: string | null;
  last_error: string | null;
}

const toConnection = (row: ConnectionRow): GoogleConnection => ({
  venueId: row.venue_id,
  accountName: row.account_name,
  locationName: row.location_name,
  locationTitle: row.location_title,
  refreshTokenEnc: row.refresh_token_enc,
  connectedBy: row.connected_by,
  connectedAt: row.connected_at,
  status: row.status,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
});

export async function getConnection(venueId: string): Promise<GoogleConnection | null> {
  const row = (await (await getDb()).get("SELECT * FROM google_connections WHERE venue_id = ?", venueId)) as ConnectionRow | undefined;
  return row ? toConnection(row) : null;
}

/** A new (or renewed) connection: the location is chosen next, so it starts unlinked. */
export async function saveConnection(venueId: string, refreshTokenEnc: string, connectedBy: string) {
  await (await getDb()).run(
    `INSERT INTO google_connections (venue_id, refresh_token_enc, connected_by, status) VALUES (?, ?, ?, 'choose_location')
     ON CONFLICT (venue_id) DO UPDATE SET refresh_token_enc = excluded.refresh_token_enc, connected_by = excluded.connected_by,
       connected_at = now(), status = 'choose_location', account_name = NULL, location_name = NULL, location_title = NULL, last_error = NULL`,
    venueId,
    refreshTokenEnc,
    connectedBy,
  );
}

export async function linkLocation(venueId: string, accountName: string, locationName: string, locationTitle: string) {
  await (await getDb()).run(
    "UPDATE google_connections SET account_name = ?, location_name = ?, location_title = ?, status = 'active', last_error = NULL WHERE venue_id = ?",
    accountName,
    locationName,
    locationTitle,
    venueId,
  );
}

export async function markConnection(venueId: string, status: GoogleConnection["status"], lastError: string | null = null) {
  await (await getDb()).run("UPDATE google_connections SET status = ?, last_error = ? WHERE venue_id = ?", status, lastError, venueId);
}

export async function markSynced(venueId: string) {
  await (await getDb()).run("UPDATE google_connections SET last_synced_at = now(), last_error = NULL WHERE venue_id = ?", venueId);
}

/** Disconnecting keeps nothing from Google: the link and every review read through it. */
export async function deleteConnection(venueId: string) {
  const db = await getDb();
  await db.run("DELETE FROM google_reviews WHERE venue_id = ?", venueId);
  await db.run("DELETE FROM google_connections WHERE venue_id = ?", venueId);
}

/** Venues linked to a location, from a Pub/Sub alert's "accounts/1/locations/2". */
export async function venuesForLocation(fullLocation: string): Promise<string[]> {
  const rows = (await (await getDb()).all(
    "SELECT venue_id FROM google_connections WHERE status = 'active' AND account_name || '/' || location_name = ?",
    fullLocation,
  )) as { venue_id: string }[];
  return rows.map((row) => row.venue_id);
}

export async function activeConnectionVenues(): Promise<string[]> {
  const rows = (await (await getDb()).all("SELECT venue_id FROM google_connections WHERE status = 'active' ORDER BY venue_id")) as { venue_id: string }[];
  return rows.map((row) => row.venue_id);
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

/**
 * replied: the owner's reply is on Google · awaiting: a draft waits for the owner ·
 * skipped: the owner chose not to reply · failed: posting didn't go through ·
 * none: nothing to do (imported before connecting, or AI unavailable).
 */
export type ReviewState = "replied" | "awaiting" | "skipped" | "failed" | "none";

export interface StoredReview {
  id: string;
  venueId: string;
  reviewerName: string | null;
  stars: number;
  comment: string | null;
  reviewTime: string;
  updateTime: string;
  replyText: string | null;
  replyTime: string | null;
  state: ReviewState;
  draftText: string | null;
  postedBy: string | null;
  imported: boolean;
}

interface ReviewRow {
  id: string;
  venue_id: string;
  reviewer_name: string | null;
  stars: number;
  comment: string | null;
  review_time: string;
  update_time: string;
  reply_text: string | null;
  reply_time: string | null;
  state: ReviewState;
  draft_text: string | null;
  posted_by: string | null;
  imported: number;
}

const toReview = (row: ReviewRow): StoredReview => ({
  id: row.id,
  venueId: row.venue_id,
  reviewerName: row.reviewer_name,
  stars: row.stars,
  comment: row.comment,
  reviewTime: row.review_time,
  updateTime: row.update_time,
  replyText: row.reply_text,
  replyTime: row.reply_time,
  state: row.state,
  draftText: row.draft_text,
  postedBy: row.posted_by,
  imported: row.imported === 1,
});

export async function getStoredReview(venueId: string, id: string): Promise<StoredReview | null> {
  const row = (await (await getDb()).get("SELECT * FROM google_reviews WHERE venue_id = ? AND id = ?", venueId, id)) as ReviewRow | undefined;
  return row ? toReview(row) : null;
}

export interface IncomingReview {
  id: string;
  reviewerName: string | null;
  stars: number;
  comment: string | null;
  reviewTime: string;
  updateTime: string;
  replyText: string | null;
  replyTime: string | null;
}

/**
 * Saves what Google says about a review. Returns the stored row and whether
 * it was new to Tapmore. A reply posted elsewhere (in Google itself) marks it
 * replied; an edited review keeps any draft the owner is working on.
 */
export async function saveFromGoogle(venueId: string, review: IncomingReview, imported: boolean): Promise<{ review: StoredReview; isNew: boolean }> {
  const db = await getDb();
  const state: ReviewState = review.replyText ? "replied" : "none";
  const inserted = await db.run(
    `INSERT INTO google_reviews (id, venue_id, reviewer_name, stars, comment, review_time, update_time, reply_text, reply_time, state, imported)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    review.id, venueId, review.reviewerName, review.stars, review.comment, review.reviewTime, review.updateTime, review.replyText, review.replyTime, state, imported ? 1 : 0,
  );
  if (inserted.changes === 0) {
    await db.run(
      `UPDATE google_reviews SET reviewer_name = ?, stars = ?, comment = ?, update_time = ?, reply_text = ?, reply_time = ?,
         state = CASE WHEN ?::text IS NOT NULL THEN 'replied' WHEN state = 'replied' THEN 'none' ELSE state END,
         draft_text = CASE WHEN ?::text IS NOT NULL THEN NULL ELSE draft_text END
       WHERE venue_id = ? AND id = ?`,
      review.reviewerName, review.stars, review.comment, review.updateTime, review.replyText, review.replyTime, review.replyText, review.replyText, venueId, review.id,
    );
  }
  return { review: (await getStoredReview(venueId, review.id))!, isNew: inserted.changes === 1 };
}

export async function saveDraft(venueId: string, id: string, draft: string, state: ReviewState = "awaiting") {
  await (await getDb()).run("UPDATE google_reviews SET draft_text = ?, state = ? WHERE venue_id = ? AND id = ?", draft, state, venueId, id);
}

export async function markReplied(venueId: string, id: string, text: string, time: string, postedBy: string) {
  await (await getDb()).run(
    "UPDATE google_reviews SET reply_text = ?, reply_time = ?, state = 'replied', draft_text = NULL, posted_by = ? WHERE venue_id = ? AND id = ?",
    text, time, postedBy, venueId, id,
  );
}

export async function setReviewState(venueId: string, id: string, state: ReviewState) {
  await (await getDb()).run("UPDATE google_reviews SET state = ? WHERE venue_id = ? AND id = ?", state, venueId, id);
}

export type ReviewFilter = "awaiting" | "all" | "replied";

export async function listStoredReviews(venueId: string, filter: ReviewFilter, limit: number, offset: number): Promise<{ rows: StoredReview[]; total: number }> {
  const where = filter === "awaiting" ? "AND state IN ('awaiting', 'failed')" : filter === "replied" ? "AND state = 'replied'" : "";
  const db = await getDb();
  const rows = (await db.all(`SELECT * FROM google_reviews WHERE venue_id = ? ${where} ORDER BY review_time DESC LIMIT ? OFFSET ?`, venueId, limit, offset)) as ReviewRow[];
  const total = ((await db.get(`SELECT COUNT(*) AS n FROM google_reviews WHERE venue_id = ? ${where}`, venueId)) as { n: number }).n;
  return { rows: rows.map(toReview), total };
}

export async function awaitingReplies(venueId: string): Promise<number> {
  return ((await (await getDb()).get("SELECT COUNT(*) AS n FROM google_reviews WHERE venue_id = ? AND state IN ('awaiting', 'failed')", venueId)) as { n: number }).n;
}
