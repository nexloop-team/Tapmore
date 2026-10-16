import { enrollRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit, requestOrigin, ServiceError } from "@/server/http";
import { enroll } from "@/server/services/loyalty";

export const POST = handle(async (request) => {
  await rateLimit(request, "enroll", 20);
  const input = await parseBody(request, enrollRequest);
  // Every join from the guest page needs the "I agree to join" box ticked.
  if (!input.agreed) throw new ServiceError(400, "Please tick the box to agree to join");
  return Response.json(await enroll(input, requestOrigin(request)));
});
