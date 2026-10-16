import { resetPasswordRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, handle, parseBody, rateLimit } from "@/server/http";
import { resetPassword } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await rateLimit(request, "reset", 10);
  const { token, password } = await parseBody(request, resetPasswordRequest);
  await resetPassword(token, password);
  return Response.json({ ok: true });
});
