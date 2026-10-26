import { reviewIdRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { skipReview } from "@/server/services/reviews";

/** The owner won't reply to this one: it leaves "Needs reply". */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews/skip">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  const { reviewId } = await parseBody(request, reviewIdRequest);
  await skipReview(venue.id, reviewId);
  return Response.json({ ok: true });
});
