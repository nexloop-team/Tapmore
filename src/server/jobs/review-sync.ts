import "server-only";
import { activeConnectionVenues } from "../repositories/google-reviews";
import { googleConfigured } from "../services/google";
import { syncVenue } from "../services/reviews";
import { claimJob, releaseJob } from "./claims";

/**
 * The backstop for Google's new-review alerts: once a day, every connected
 * venue's reviews are read again, so a missed alert only delays a reply.
 * Returns how many new reviews were found.
 */
export async function runReviewSync(now: Date): Promise<number> {
  if (!googleConfigured()) return 0;
  const day = now.toISOString().slice(0, 10);
  let added = 0;
  for (const venueId of await activeConnectionVenues()) {
    const key = `${venueId}:${day}`;
    if (!(await claimJob("reviewSync", key))) continue;
    try {
      added += (await syncVenue(venueId)).added;
    } catch (error) {
      console.error("[jobs] review sync failed", venueId, error);
      await releaseJob("reviewSync", key);
    }
  }
  return added;
}
