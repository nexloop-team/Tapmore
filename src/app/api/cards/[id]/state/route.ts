import { handle, rateLimitLocal, ServiceError } from "@/server/http";
import { findCardState } from "@/server/repositories/loyalty-cards";

/**
 * The cheap check an open member card polls (see components/card/useCardChanges):
 * the stamp count and a change marker. The card fetches its full view only
 * when the marker moves.
 */
export const GET = handle(async (request, ctx: RouteContext<"/api/cards/[id]/state">) => {
  rateLimitLocal(request, "card-state", 120);
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const state = token ? await findCardState(id, token) : null;
  if (!state) throw new ServiceError(404, "Card not found");
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
});
