import { staffBirthdayRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { giveBirthdayReward, requireStaffDevice } from "@/server/services/staff";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId } = await parseBody(request, staffBirthdayRequest);
  return Response.json(await giveBirthdayReward(device, cardId));
});
