import { reviewIdRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit } from "@/server/http";
import { redraft } from "@/server/services/reviews";

/** A fresh AI draft for one review. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews/redraft">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "reviews-redraft", 20);
  const { reviewId } = await parseBody(request, reviewIdRequest);
  const review = await redraft(venue.id, reviewId);
  return Response.json({ draft: review.draftText ?? "" });
});
