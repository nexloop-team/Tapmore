import { staffUndoRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { requireStaffDevice, undoLast } from "@/server/services/staff";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, requestId } = await parseBody(request, staffUndoRequest);
  return Response.json(await undoLast(device, cardId, requestId));
});
