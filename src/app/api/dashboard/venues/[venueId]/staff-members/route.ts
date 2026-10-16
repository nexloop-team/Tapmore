import { inviteStaffRequest } from "@/lib/api/staff-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { publicOrigin } from "@/server/services/qr";
import { createStaffInvite } from "@/server/services/staff-invites";

/** Invites a staff member by email; returns the link too, so the owner can also send it another way. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/staff-members">) => {
  const { user, venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "staff-invite", 20);
  const { email } = await parseBody(request, inviteStaffRequest);
  return Response.json(await createStaffInvite(venue, user, email, publicOrigin(requestOrigin(request))));
});
