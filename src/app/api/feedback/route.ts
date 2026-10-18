import { feedbackRequest } from "@/lib/api/contracts";
import { clientIp, handle, parseBody, rateLimitMany } from "@/server/http";
import { submitFeedback } from "@/server/services/feedback";

export const POST = handle(async (request) => {
  const ip = clientIp(request);
  await rateLimitMany([
    { key: `feedback:${ip}`, limit: 10 },
    { key: `feedback-day:${ip}`, limit: 60, windowMs: 24 * 60 * 60_000 },
  ]);
  const input = await parseBody(request, feedbackRequest);
  return Response.json(await submitFeedback(input));
});
