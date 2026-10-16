import { wifiPasswordRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { wifiPassword } from "@/server/services/guests";

/** The Wi-Fi password behind the email gate, for a guest who has passed it. */
export const POST = handle(async (request) => {
  await rateLimit(request, "wifi-password", 20);
  return Response.json(await wifiPassword(await parseBody(request, wifiPasswordRequest)), { headers: { "Cache-Control": "no-store" } });
});
