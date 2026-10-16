import { staffRedeemRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { redeemReward, requireStaffDevice } from "@/server/services/staff";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, tierIndex } = await parseBody(request, staffRedeemRequest);
  return Response.json(await redeemReward(device, cardId, tierIndex));
});
