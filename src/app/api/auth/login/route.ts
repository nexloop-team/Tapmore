import { loginRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, clientIp, handle, parseBody, rateLimit } from "@/server/http";
import { login } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await rateLimit(request, "login", 20);
  await login(await parseBody(request, loginRequest), clientIp(request));
  return Response.json({ ok: true });
});
