import { staffUndoRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { giveFriendReward, requireStaffDevice } from "@/server/services/staff";

/** Refer a friend without stamps: the member's reward for a friend who visited. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, requestId } = await parseBody(request, staffUndoRequest);
  return Response.json(await giveFriendReward(device, cardId, requestId));
});
