import { addStaffDeviceRequest } from "@/lib/api/staff-contracts";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { publicOrigin, qrSvg } from "@/server/services/qr";
import { createPairing } from "@/server/services/staff";

/** Starts pairing a till device: a one-time link (and its QR) valid for 15 minutes. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/staff-devices">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "staff-pairing", 20);
  const { label } = await parseBody(request, addStaffDeviceRequest);
  const { token, expiresAt } = await createPairing(venue.id, label);
  const url = `${publicOrigin(requestOrigin(request))}/api/staff/pair?t=${encodeURIComponent(token)}`;
  return Response.json({ url, qrSvg: await qrSvg(url), expiresAt });
});
