import "server-only";
import { unstable_rethrow } from "next/navigation";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { getDb, timeDb } from "./db";
import { reportError } from "./monitoring";

/** Thrown by services; routes turn it into a JSON error with this status. */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError(400, "Request body must be JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ServiceError(400, result.error.issues[0]?.message ?? "Invalid request");
  return result.data;
}

/**
 * Origin for absolute links in emails and the same-origin check. APP_URL wins
 * when set: request headers are client-controlled, so trusting them would let
 * anyone send a password-reset email whose link points at their own site.
 * Without APP_URL (local development) the proxy headers are honoured.
 */
export function requestOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return forwardedHost ? `${proto}://${forwardedHost}` : url.origin;
}

/**
 * The visitor's IP address, for rate limits. The left end of X-Forwarded-For
 * is whatever the client typed, so it's read from the right: each proxy in
 * front of the app appends the address it saw. TRUSTED_PROXY_COUNT is how
 * many proxies there are (default 1: the host's load balancer; 2 with
 * Cloudflare in front of it). CLIENT_IP_HEADER names a header a CDN sets
 * itself (e.g. cf-connecting-ip), which wins when present.
 */
export function clientIp(request: Request): string {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const fromHeader = header ? request.headers.get(header)?.split(",")[0].trim() : "";
  if (fromHeader) return fromHeader;
  const hops = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  const proxies = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_COUNT) || 1));
  return hops[Math.max(0, hops.length - proxies)] || "local";
}

const TOO_MANY = "Too many requests, please try again shortly";
const buckets = new Map<string, { hits: number[]; windowMs: number }>();
let checks = 0;

/** Forgets keys whose window has passed, so changing addresses can't grow memory without end. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - (bucket.hits[bucket.hits.length - 1] ?? 0) >= bucket.windowMs) buckets.delete(key);
  }
}

/** This instance's own sliding-window count: free, but each serverless copy of the app has its own. */
function countLocally(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (++checks % 1000 === 0 || buckets.size > 50_000) sweep(now);
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new ServiceError(429, TOO_MANY);
  hits.push(now);
  buckets.set(key, { hits, windowMs });
}

/**
 * Fixed-window counters in Postgres, shared by every instance (Vercel runs
 * many, each with its own memory). Keys are hashed, so emails used as keys
 * aren't stored. Several counters go up in one write; returns each one's
 * hits in its current window, in the order given.
 */
async function countShared(counters: { key: string; windowMs: number }[]): Promise<number[]> {
  const now = Date.now();
  const rows = counters.map(({ key, windowMs }) => {
    const windowStart = now - (now % windowMs);
    return [createHash("sha256").update(`${windowMs}:${key}`).digest("base64url"), windowStart, new Date(windowStart + windowMs).toISOString()] as const;
  });
  const result = (await (await getDb()).all(
    `INSERT INTO rate_limits (key, window_start, hits, expires_at) VALUES ${rows.map(() => "(?, ?, 1, ?)").join(", ")}
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN rate_limits.window_start = EXCLUDED.window_start THEN rate_limits.hits + 1 ELSE 1 END,
       window_start = EXCLUDED.window_start,
       expires_at = EXCLUDED.expires_at
     RETURNING key, hits`,
    ...rows.flat(),
  )) as unknown as { key: string; hits: number }[];
  const hits = new Map(result.map((row) => [row.key, row.hits]));
  return rows.map(([key]) => hits.get(key) ?? 0);
}

/**
 * Limits what one address can do to a route, across every instance of the
 * app. This instance's own count is checked first, so a script hammering one
 * instance is turned away without touching the database.
 */
export async function rateLimit(request: Request, route: string, limit: number, windowMs = 60_000) {
  await rateLimitKey(`${route}:${clientIp(request)}`, limit, windowMs);
}

/** The same limiter on any key, e.g. per account email for login attempts. */
export async function rateLimitKey(key: string, limit: number, windowMs = 60_000) {
  await rateLimitMany([{ key, limit, windowMs }]);
}

/** Several limits at once (say per minute and per day) for one database write. Keys must differ. */
export async function rateLimitMany(limits: { key: string; limit: number; windowMs?: number }[]) {
  const counters = limits.map(({ key, limit, windowMs = 60_000 }) => {
    countLocally(key, limit, windowMs);
    return { key, windowMs };
  });
  let hits: number[];
  try {
    hits = await countShared(counters);
  } catch (error) {
    // The local counts above still apply; a database hiccup shouldn't take sign-in down with it.
    console.error("[rate-limit] shared counter unavailable", error);
    return;
  }
  if (hits.some((count, i) => count > limits[i].limit)) throw new ServiceError(429, TOO_MANY);
}

/**
 * Counts one more use of `key` and says whether it's still within `limit`
 * for the window, without refusing the request: for quietly skipping a side
 * effect (an email) rather than failing the whole call. False if the counter
 * can't be reached, so a side effect is skipped rather than sent unchecked.
 */
export async function underLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    return (await countShared([{ key, windowMs }]))[0] <= limit;
  } catch (error) {
    console.error("[rate-limit] shared counter unavailable", error);
    return false;
  }
}

/**
 * This instance's count only, for high-volume endpoints where a database
 * write per request costs more than a looser limit (analytics beacons, card
 * polling): nothing there is worth guessing at.
 */
export function rateLimitLocal(request: Request, route: string, limit: number, windowMs = 60_000) {
  countLocally(`${route}:${clientIp(request)}`, limit, windowMs);
}

export function rateLimitKeyLocal(key: string, limit: number, windowMs = 60_000) {
  countLocally(key, limit, windowMs);
}

/**
 * CSRF guard for cookie-authenticated writes. SameSite=Lax already keeps the
 * session cookie off cross-site POSTs; this also refuses any request a
 * browser marks as coming from another origin.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin !== requestOrigin(request) && origin !== new URL(request.url).origin) throw new ServiceError(403, "Cross-origin request refused");
    return;
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ServiceError(403, "Cross-origin request refused");
}

/** Wraps a handler so ServiceErrors become JSON responses and anything else a 500. */
export function handle<C = unknown>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const started = performance.now();
    const timing = { ms: 0, queries: 0 };
    let response: Response;
    try {
      response = await timeDb(timing, () => fn(request, ctx));
    } catch (error) {
      // Next's own signals (a redirect, "render this at request time") pass through untouched.
      unstable_rethrow(error);
      if (error instanceof ServiceError) response = jsonError(error.status, error.message);
      else {
        reportError(error, new URL(request.url).pathname);
        response = jsonError(500, "Internal error");
      }
    }
    return withServerTiming(response, timing, performance.now() - started);
  };
}

/**
 * Where the time went, shown in the browser's network panel: database time
 * and query count, and the whole request. Durations only; nothing about
 * what was asked.
 */
function withServerTiming(response: Response, timing: { ms: number; queries: number }, totalMs: number): Response {
  try {
    response.headers.append("Server-Timing", `db;dur=${timing.ms.toFixed(1)};desc="${timing.queries} quer${timing.queries === 1 ? "y" : "ies"}", total;dur=${totalMs.toFixed(1)}`);
  } catch {
    /* a response whose headers can't change (rare): sent as it is */
  }
  return response;
}
