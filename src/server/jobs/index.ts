import "server-only";
import { runGuestAutomations } from "./guest-emails";
import { runHousekeeping } from "./housekeeping";
import { runMediaCleanup } from "./media-cleanup";

/**
 * Background jobs. One in-process ticker per server (started from
 * instrumentation.ts) runs every job hourly; each job decides for itself
 * what is due and claims it in `job_runs` first, so a restart, a second tick
 * or an external cron call (`POST /api/cron/run`) never sends anything twice.
 */

const TICK_MS = 60 * 60_000;
const FIRST_TICK_MS = 60_000;

export async function runDueJobs(now = new Date()): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  for (const [name, job] of [
    ["guestAutomations", runGuestAutomations],
    ["mediaCleanup", runMediaCleanup],
    ["housekeeping", runHousekeeping],
  ] as const) {
    try {
      results[name] = await job(now);
    } catch (error) {
      console.error(`[jobs] ${name} failed`, error);
      results[name] = -1;
    }
  }
  return results;
}

declare global {
  var __jobTimer: NodeJS.Timeout | undefined;
}

export function startJobScheduler() {
  if (globalThis.__jobTimer) return;
  const tick = () => {
    void runDueJobs().then((results) => {
      const sent = Object.entries(results).filter(([, n]) => n !== 0);
      if (sent.length) console.info("[jobs]", Object.fromEntries(sent));
    });
  };
  setTimeout(tick, FIRST_TICK_MS).unref();
  globalThis.__jobTimer = setInterval(tick, TICK_MS);
  globalThis.__jobTimer.unref();
}
