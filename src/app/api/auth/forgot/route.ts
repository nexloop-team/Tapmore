import { forgotPasswordRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { requestPasswordReset } from "@/server/services/accounts";
import { verifyCaptcha } from "@/server/services/captcha";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await rateLimit(request, "forgot", 5);
  const { email, captchaToken } = await parseBody(request, forgotPasswordRequest);
  await verifyCaptcha(captchaToken, request);
  await requestPasswordReset(email, requestOrigin(request));
  return Response.json({ ok: true });
});
