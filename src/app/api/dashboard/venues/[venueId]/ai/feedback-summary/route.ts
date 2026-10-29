import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit } from "@/server/http";
import { feedbackSummary } from "@/server/services/feedback-summary";

/** "What guests said this week": the saved AI summary, rewritten only when new feedback has come in. */
export const GET = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/ai/feedback-summary">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId);
  await rateLimit(request, "feedback-summary", 30);
  return Response.json(await feedbackSummary({ id: venue.id, name: venue.config.name, venueType: venue.config.venueType }), { headers: { "Cache-Control": "no-store" } });
});
