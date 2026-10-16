import "server-only";
import { getDb } from "../db";
import { claimJob } from "./claims";

/**
 * Once a day: deletes what has served its purpose, so tables don't grow
 * forever and personal data isn't kept longer than it's needed (the privacy
 * notice promises these periods). Returns how many rows went.
 */
const RULES: [table: string, where: string][] = [
  ["sessions", "expires_at < now()"],
  ["auth_tokens", "expires_at < now() - INTERVAL '1 day' OR used_at < now() - INTERVAL '1 day'"],
  ["staff_pairings", "expires_at < now() - INTERVAL '1 day'"],
  ["staff_invites", "expires_at < now() - INTERVAL '30 days'"],
  ["admin_edit_grants", "expires_at < now()"],
  ["rate_limits", "expires_at < now()"],
  // Email copies: long enough to answer "did my email go?", no longer.
  ["outbox", "created_at < now() - INTERVAL '90 days'"],
  // Scan analytics feed 12-month charts.
  ["events", "created_at < now() - INTERVAL '400 days'"],
  ["job_runs", "ran_at < now() - INTERVAL '400 days'"],
  ["ai_usage", "day < to_char(now() - INTERVAL '60 days', 'YYYY-MM-DD')"],
];

export async function runHousekeeping(now = new Date()): Promise<number> {
  if (!(await claimJob("housekeeping", now.toISOString().slice(0, 10)))) return 0;
  const db = await getDb();
  let removed = 0;
  for (const [table, where] of RULES) removed += (await db.run(`DELETE FROM ${table} WHERE ${where}`)).changes;
  // A feedback stamp can only be claimed within the hour; the token has no use after that.
  await db.run("UPDATE feedback SET stamp_token = NULL WHERE stamp_token IS NOT NULL AND created_at < now() - INTERVAL '1 day'");
  return removed;
}
