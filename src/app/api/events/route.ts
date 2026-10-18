import { analyticsBatch } from "@/lib/api/contracts";
import { getDb } from "@/server/db";
import { clientIp, handle, parseBody, rateLimitKeyLocal, rateLimitLocal } from "@/server/http";

/** Venue ids seen recently, so every event doesn't cost a lookup. */
const knownVenues = new Map<string, number>();
const KNOWN_MS = 10 * 60_000;

async function venueExists(venueId: string): Promise<boolean> {
  const now = Date.now();
  if ((knownVenues.get(venueId) ?? 0) > now) return true;
  const found = !!(await (await getDb()).get("SELECT 1 FROM venues WHERE id = ?", venueId));
  if (found) {
    if (knownVenues.size > 10_000) knownVenues.clear();
    knownVenues.set(venueId, now + KNOWN_MS);
  }
  return found;
}

/**
 * First-party analytics sink for the guest pages (sent with sendBeacon), one
 * event or a batch tracked together, stored in one write. Anyone can post
 * here, so it only takes events for real venues, and caps what one address
 * can add to one venue's numbers: a busy café's guests share an address on
 * its Wi-Fi, so the cap is generous, not exact.
 */
export const POST = handle(async (request) => {
  const { events } = await parseBody(request, analyticsBatch);
  const ip = clientIp(request);
  const rows: [string, string, string | null][] = [];
  for (const event of events) {
    rateLimitLocal(request, "events", 240);
    const venueId = typeof event.params?.venue_id === "string" ? event.params.venue_id.slice(0, 128) : null;
    if (venueId) {
      if (!(await venueExists(venueId))) continue;
      rateLimitKeyLocal(`events:${venueId}:${ip}`, 600, 60 * 60_000);
      if (event.name === "landing_opened") rateLimitKeyLocal(`scans:${venueId}:${ip}`, 120, 60 * 60_000);
    }
    rows.push([event.name, JSON.stringify(event.params ?? {}), venueId]);
  }
  if (rows.length > 0) {
    (await (await getDb()).run(`INSERT INTO events (name, params, venue_id) VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}`, ...rows.flat()));
  }
  return new Response(null, { status: 204 });
});
