export type EventParams = Record<string, string | number | boolean | null>;
export type Track = (name: string, params?: EventParams) => void;

const VISIT_KEY = "tt_visit";
/** Events per beacon (the server takes up to 20). */
const MAX_BATCH = 20;
const VISIT_IDLE_MS = 30 * 60 * 1000;
let fallbackVisit: string | null = null;

/**
 * One id per visit: kept on the phone and renewed after 30 idle minutes, so
 * a refresh, going to the menu and back, or scanning the code again (which
 * opens a new tab) is still the same visit and counts as one scan.
 */
function visitId(): string {
  const fresh = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  try {
    const saved = JSON.parse(localStorage.getItem(VISIT_KEY) ?? "null") as { id: string; at: number } | null;
    const id = saved && Date.now() - saved.at < VISIT_IDLE_MS ? saved.id : fresh();
    localStorage.setItem(VISIT_KEY, JSON.stringify({ id, at: Date.now() }));
    return id;
  } catch {
    fallbackVisit ??= fresh();
    return fallbackVisit;
  }
}

type QueuedEvent = { name: string; params: EventParams };
let queue: QueuedEvent[] = [];

/** Sends what's queued as one beacon (one request, one database write). */
function flush() {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  try {
    const body = JSON.stringify({ events });
    if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the page */
  }
}

/**
 * First-party analytics: every event carries the venue, the scan source and a
 * visit id (see visitId), and is delivered with sendBeacon so it survives
 * the tap that navigates away. Events tracked together (a page opening, a
 * tap and what it opens) go out as one beacon, sent before the browser does
 * anything else. Booleans are sent as 1/0 so they aggregate as numbers in
 * any warehouse.
 */
export function createTracker(base: { venueId: string | null; source: string; page: string; team?: boolean }): Track {
  return (name, params = {}) => {
    const payload: EventParams = { session_id: visitId(), platform: "web", page: base.page, source: base.source, ...params };
    // The venue's own people (signed in as its owner, staff or an admin) aren't guests: their visits stay out of the stats.
    if (base.team) payload.team = 1;
    if (base.venueId) payload.venue_id = base.venueId;
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === "boolean") payload[key] = payload[key] ? 1 : 0;
    }
    if (process.env.NODE_ENV !== "production") console.debug(`[analytics] ${name}`, payload);
    if (queue.push({ name, params: payload }) === 1) queueMicrotask(flush);
    if (queue.length >= MAX_BATCH) flush();
  };
}
