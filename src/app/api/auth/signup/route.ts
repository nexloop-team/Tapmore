import { signupRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit, requestOrigin } from "@/server/http";
import { signup } from "@/server/services/accounts";
import { verifyCaptcha } from "@/server/services/captcha";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await rateLimit(request, "signup", 5);
  const input = await parseBody(request, signupRequest);
  await verifyCaptcha(input.captchaToken, request);
  await signup(input, requestOrigin(request));
  return Response.json({ ok: true });
});
