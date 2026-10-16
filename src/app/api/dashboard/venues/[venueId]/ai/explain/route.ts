import { explainDishesRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit, ServiceError } from "@/server/http";
import { venueHasAccess } from "@/server/repositories/subscriptions";
import { explainDishes } from "@/server/services/ai";

/** Drafts "What's this?" notes for the owner to review; nothing is saved here. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/ai/explain">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  if (!await venueHasAccess(venue.id)) throw new ServiceError(402, "Your subscription has ended. Renew it on the Billing page to use this.");
  await rateLimit(request, "ai-explain", 20);
  const { items, onlyUnfamiliar } = await parseBody(request, explainDishesRequest);
  const suggestions = await explainDishes({ id: venue.id, name: venue.config.name, venueType: venue.config.venueType }, items, onlyUnfamiliar);
  return Response.json({ suggestions });
});
