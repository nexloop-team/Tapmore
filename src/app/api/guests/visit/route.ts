import { recordVisitRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { recordGuestVisit } from "@/server/services/guests";

export const POST = handle(async (request) => {
  await rateLimit(request, "visit", 30);
  await recordGuestVisit(await parseBody(request, recordVisitRequest));
  return Response.json({ ok: true });
});
