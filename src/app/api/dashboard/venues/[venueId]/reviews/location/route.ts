import { reviewLocationRequest } from "@/lib/api/account-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody } from "@/server/http";
import { chooseLocation } from "@/server/services/reviews";

/** Which of the Google account's Business Profiles is this venue. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/reviews/location">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  const { account, location } = await parseBody(request, reviewLocationRequest);
  await chooseLocation(venue.id, account, location);
  return Response.json({ ok: true });
});
