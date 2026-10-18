import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "../db";
import { getDb } from "../db";

interface NewFeedback {
  id: string;
  venueId: string;
  text: string;
  sentiment: number;
  source: string | null;
  imagePath: string | null;
  /** Lets the guest claim one feedback stamp; stored hashed. */
  stampToken: string | null;
}

const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

/** How long after posting feedback its stamp can be claimed. */
const STAMP_CLAIM_MINUTES = 60;

export async function insertFeedback(input: NewFeedback) {
  (await (await getDb()).run("INSERT INTO feedback (id, venue_id, text, sentiment, source, image_path, stamp_token) VALUES (?, ?, ?, ?, ?, ?, ?)", input.id, input.venueId, input.text, input.sentiment, input.source, input.imagePath, input.stampToken ? digest(input.stampToken) : null));
}

/** Uses up a feedback receipt: true once, for this venue's recent feedback with the matching token. */
export async function claimFeedbackStamp(db: Db, venueId: string, feedbackId: string, token: string): Promise<boolean> {
  const result = await db.run(
    `UPDATE feedback SET stamp_claimed_at = now()
      WHERE id = ? AND venue_id = ? AND stamp_token = ? AND stamp_claimed_at IS NULL
        AND created_at >= now() - CAST(? AS INTERVAL)`,
    feedbackId, venueId, digest(token), `${STAMP_CLAIM_MINUTES} minutes`,
  );
  return result.changes === 1;
}

/** Feedback photos a venue received today (UTC), to cap what anonymous guests can upload. */
export async function photosToday(venueId: string): Promise<number> {
  return ((await (await getDb()).get("SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? AND image_path IS NOT NULL AND created_at >= date_trunc('day', now())", venueId)) as { n: number }).n;
}

/** Feedback newer than this owner's last look at the inbox (or the last 14 days, before their first look). */
export async function unreadFeedback(venueId: string, userId: string): Promise<{ count: number; latest: string | null }> {
  // One round trip: the owner's last look, the count since, and the newest note.
  const row = (await (await getDb()).get(
    `SELECT COUNT(*) AS n, (array_agg(f.text ORDER BY f.created_at DESC))[1] AS latest
       FROM feedback f
      WHERE f.venue_id = ?
        AND f.created_at > COALESCE((SELECT feedback_seen_at FROM venue_members WHERE venue_id = ? AND user_id = ?), now() + INTERVAL '-14 days')`,
    venueId, venueId, userId,
  )) as { n: number; latest: string | null };
  return { count: row.n, latest: row.n ? row.latest : null };
}

export async function markFeedbackSeen(venueId: string, userId: string) {
  (await (await getDb()).run("UPDATE venue_members SET feedback_seen_at = now() WHERE venue_id = ? AND user_id = ?", venueId, userId));
}
