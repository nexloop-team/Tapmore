import { staffStampRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { requireStaffDevice, stampCard } from "@/server/services/staff";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, count, force } = await parseBody(request, staffStampRequest);
  return Response.json(await stampCard(device, cardId, count, !!force));
});
