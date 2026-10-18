import "server-only";
import { revalidateTag } from "next/cache";

/**
 * The guest pages' venue lookup is cached across requests and servers
 * ("use cache: remote" in repositories/venues: Vercel's shared runtime cache,
 * or this server's memory when self-hosted). Every write to a venue or its
 * subscription calls forgetVenue, which ends the cached copy at once (no
 * stale copy is ever served after a change), so a saved page, a lapsed or
 * renewed subscription, or a suspension shows on the very next scan.
 */

/** Every cached lookup that found this venue, by whatever id, code or old code it was asked for. */
export const venueTag = (venueId: string) => `venue:${venueId}`;
/** The lookup of this exact id or code, found or not (a new venue or address may take it). */
export const venueCodeTag = (idOrCode: string) => `venue-code:${idOrCode}`;

/** Unit tests and scripts run the repositories outside Next.js: no cache there, they read the database. */
export const venueCacheOn = !process.env.VITEST;

/** Call after the write has committed. `codes`: ids or addresses whose "not found" may now be wrong. */
export function forgetVenue(venueId: string, ...codes: string[]) {
  if (!venueCacheOn) return;
  for (const tag of [venueTag(venueId), ...codes.map(venueCodeTag)]) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      // Outside a request (a script): there's no cache to clear.
      console.error("[venue-cache] couldn't clear", tag, error);
    }
  }
}
