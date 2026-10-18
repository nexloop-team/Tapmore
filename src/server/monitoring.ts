import "server-only";

/**
 * Error reports (Sentry), on the server only: the browser SDK would add tens
 * of KB to every guest page. Off unless SENTRY_DSN is set, and then loaded on
 * first use, so a server without it pays nothing.
 */
export const monitoringOn = !!process.env.SENTRY_DSN;

/** Logs an unexpected error and, when monitoring is on, reports it. */
export function reportError(error: unknown, where?: string) {
  console.error(where ? `[${where}]` : "[error]", error);
  if (!monitoringOn) return;
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error, where ? { tags: { where } } : undefined))
    .catch(() => {});
}

type SpanData = Record<string, unknown>;
type SentryEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  contexts?: { trace?: { data?: SpanData }; nextjs?: { request_path?: string } };
  spans?: { data?: SpanData; description?: string }[];
};

/** Span attributes that hold an address (with its query string). */
const URL_KEYS = ["http.target", "http.url", "url.full", "http.route.full", "next.route.full"];

/** One span's attributes, without request headers (cookies among them) or query strings. */
function scrubSpanData(data: SpanData | undefined) {
  if (!data) return;
  for (const key of Object.keys(data)) {
    if (key.startsWith("http.request.header.") || key.startsWith("http.response.header.") || key === "url.query") delete data[key];
    else if (URL_KEYS.includes(key) && typeof data[key] === "string") data[key] = (data[key] as string).split("?")[0];
  }
}

/**
 * What leaves for Sentry: no query strings (card links, reset and
 * verification links carry private tokens there), no cookies, no headers, no
 * request bodies (feedback notes, guests' emails), in error reports and in
 * traces alike.
 */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  scrubSpanData(event.contexts?.trace?.data);
  const nextjs = event.contexts?.nextjs;
  if (nextjs?.request_path) nextjs.request_path = nextjs.request_path.split("?")[0];
  for (const span of event.spans ?? []) {
    scrubSpanData(span.data);
    if (span.description?.includes("?")) span.description = span.description.split("?")[0];
  }
  return event;
}
