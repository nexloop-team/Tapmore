import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit } from "@/server/http";
import { syncVenue } from "@/server/services/reviews";

/** "Check now": reads the latest reviews from Google straight away. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews/sync">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "reviews-sync", 6);
  return Response.json(await syncVenue(venue.id));
});
