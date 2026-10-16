import { staffBirthdayDateRequest } from "@/lib/api/staff-contracts";
import { assertSameOrigin, handle, parseBody, rateLimitKey } from "@/server/http";
import { requireStaffDevice, setGuestBirthday } from "@/server/services/staff";

/** Staff add or correct a guest's birthday at the till. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const device = await requireStaffDevice();
  await rateLimitKey(`staff:${device.id}`, 60);
  const { cardId, month, day } = await parseBody(request, staffBirthdayDateRequest);
  return Response.json(await setGuestBirthday(device, cardId, month, day));
});
