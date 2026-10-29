import "server-only";
import { getDb } from "../db";
import { venueHasAccess } from "../repositories/subscriptions";
import { aiConfigured, summarizeFeedback, type FeedbackSummary } from "./ai";

/** Notes needed before a summary says anything useful. */
const MIN_NOTES = 3;
const WINDOW_DAYS = 7;
const MAX_NOTES = 150;
const MAX_NOTE_CHARS = 600;

type FeedbackSummaryState =
  | { state: "ready"; summary: FeedbackSummary; notes: number; createdAt: string }
  | { state: "too_few"; notes: number }
  | { state: "unavailable" };

/**
 * "What guests said this week" for the overview: an AI summary of the last
 * seven days of feedback. It's saved and only rewritten when the set of notes
 * changes (new feedback, or old notes leaving the window), so opening the
 * dashboard doesn't call the AI each time. Never emailed.
 */
export async function feedbackSummary(venue: { id: string; name: string; venueType?: string | null }): Promise<FeedbackSummaryState> {
  const db = await getDb();
  const rows = await db.all<{ id: string; text: string; sentiment: number; created_at: string }>(
    `SELECT id, text, sentiment, created_at FROM feedback
      WHERE venue_id = ? AND created_at >= now() - CAST(? AS INTERVAL)
      ORDER BY created_at DESC LIMIT ?`,
    venue.id, `${WINDOW_DAYS} days`, MAX_NOTES,
  );
  if (rows.length < MIN_NOTES) return { state: "too_few", notes: rows.length };

  // Which notes the summary covers: the same set means the saved one still fits.
  const fingerprint = `${rows.length}:${rows[0].id}:${rows[rows.length - 1].id}`;
  const saved = await db.get<{ fingerprint: string; summary: FeedbackSummary; created_at: string }>(
    "SELECT fingerprint, summary, created_at FROM feedback_summaries WHERE venue_id = ?", venue.id,
  );
  if (saved?.fingerprint === fingerprint) return { state: "ready", summary: saved.summary, notes: rows.length, createdAt: saved.created_at };
  // No AI, or a lapsed subscription: keep showing the last summary if there is one.
  if (!aiConfigured() || !(await venueHasAccess(venue.id))) {
    return saved ? { state: "ready", summary: saved.summary, notes: rows.length, createdAt: saved.created_at } : { state: "unavailable" };
  }

  const notes = rows.map((row) => ({
    text: row.text.slice(0, MAX_NOTE_CHARS),
    mood: row.sentiment >= 0.25 ? ("good" as const) : row.sentiment <= -0.25 ? ("bad" as const) : ("neutral" as const),
    day: row.created_at.slice(0, 10),
  }));
  const summary = await summarizeFeedback(venue, notes);
  const stored = await db.get<{ created_at: string }>(
    `INSERT INTO feedback_summaries (venue_id, fingerprint, summary) VALUES (?, ?, ?)
     ON CONFLICT (venue_id) DO UPDATE SET fingerprint = excluded.fingerprint, summary = excluded.summary, created_at = now()
     RETURNING created_at`,
    venue.id, fingerprint, JSON.stringify(summary),
  );
  return { state: "ready", summary, notes: rows.length, createdAt: stored?.created_at ?? new Date().toISOString() };
}
