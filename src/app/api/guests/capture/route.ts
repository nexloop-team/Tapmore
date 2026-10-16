import { captureGuestRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { captureGuest } from "@/server/services/guests";

/** The Wi-Fi email gate, for venues whose owner switched it on. */
export const POST = handle(async (request) => {
  await rateLimit(request, "capture", 20);
  const input = await parseBody(request, captureGuestRequest);
  return Response.json(await captureGuest(input));
});
