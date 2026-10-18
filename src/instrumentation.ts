import type { Instrumentation } from "next";

/**
 * Runs once per server start. In production it first lists any settings a
 * launch still needs (see server/env-check.ts), and turns on error reports
 * and traces when SENTRY_DSN is set (server only; see server/monitoring).
 * Then it starts the background job ticker (birthday emails, clean-up) in
 * the Node.js runtime only; set DISABLE_JOBS=1 to run jobs from an external
 * scheduler via `POST /api/cron/run` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") {
    const { reportProductionConfig } = await import("./server/env-check");
    reportProductionConfig();
  }
  if (process.env.SENTRY_DSN) {
    const [Sentry, { scrubEvent }] = await Promise.all([import("@sentry/nextjs"), import("./server/monitoring")]);
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // A tenth of requests traced (where time goes: rendering, queries, outside calls); errors are always sent.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      sendDefaultPii: false,
      beforeSend: (event) => scrubEvent(event),
      beforeSendTransaction: (event) => scrubEvent(event),
    });
  }
  // Serverless copies come and go, so a timer in each would be unreliable and
  // multiply database connections: on Vercel, Vercel Cron runs the jobs.
  if (process.env.DISABLE_JOBS !== "1" && !process.env.VERCEL) {
    const { startJobScheduler } = await import("./server/jobs");
    startJobScheduler();
  }
}

/** Errors thrown while rendering a page or running a route, reported when monitoring is on. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
