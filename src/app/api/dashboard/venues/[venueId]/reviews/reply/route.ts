import { reviewReplyRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit } from "@/server/http";
import { postReply } from "@/server/services/reviews";

/** Posts the owner's reply on Google (a draft as written or edited, or a change to an earlier reply). */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews/reply">) => {
  const { user, venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "reviews-reply", 30);
  const { reviewId, text } = await parseBody(request, reviewReplyRequest);
  await postReply(venue.id, reviewId, text, user);
  return Response.json({ ok: true });
});
