import { feedbackRequest } from "@/lib/api/contracts";
import { handle, parseBody, rateLimit } from "@/server/http";
import { submitFeedback } from "@/server/services/feedback";

export const POST = handle(async (request) => {
  await rateLimit(request, "feedback", 10);
  await rateLimit(request, "feedback-day", 60, 24 * 60 * 60_000);
  const input = await parseBody(request, feedbackRequest);
  return Response.json(await submitFeedback(input));
});
