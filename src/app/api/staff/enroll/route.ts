import { staffEnrollRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey, requestOrigin } from "@/server/http";
import { enrollAtTill, requireStaffDevice } from "@/server/services/staff";

/** Staff sign a guest up to the stamp card at the counter. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff-enroll:${device.id}`, 30);
  const input = await parseBody(request, staffEnrollRequest);
  return Response.json(await enrollAtTill(device, input, requestOrigin(request)));
});
