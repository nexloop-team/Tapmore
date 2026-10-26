import { venueFromRequest } from "@/server/dashboard";
import { handle } from "@/server/http";
import { disconnect } from "@/server/services/reviews";

/** Disconnects Google: the access is revoked and nothing read from Google is kept. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await disconnect(venue.id);
  return Response.json({ ok: true });
});
