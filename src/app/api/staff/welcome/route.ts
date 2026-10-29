import { staffUndoRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { giveWelcomeOffer, requireStaffDevice } from "@/server/services/staff";

/** Refer a friend without stamps: an invited friend's welcome offer, on their first visit. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, requestId } = await parseBody(request, staffUndoRequest);
  return Response.json(await giveWelcomeOffer(device, cardId, requestId));
});
