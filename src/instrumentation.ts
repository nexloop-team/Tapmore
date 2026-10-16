/**
 * Runs once per server start. In production it first lists any settings a
 * launch still needs (see server/env-check.ts). Then it starts the
 * background job ticker (birthday emails, clean-up) in the
 * Node.js runtime only; set DISABLE_JOBS=1 to run jobs from an external
 * scheduler via `POST /api/cron/run` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") {
    const { reportProductionConfig } = await import("./server/env-check");
    reportProductionConfig();
  }
  // Serverless copies come and go, so a timer in each would be unreliable and
  // multiply database connections: on Vercel, Vercel Cron runs the jobs.
  if (process.env.DISABLE_JOBS !== "1" && !process.env.VERCEL) {
    const { startJobScheduler } = await import("./server/jobs");
    startJobScheduler();
  }
}
