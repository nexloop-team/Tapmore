import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, rateLimitKey, requestOrigin } from "@/server/http";
import { sendVerificationEmail } from "@/server/services/accounts";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  if (user.emailVerified) return Response.json({ ok: true });
  await rateLimitKey(`verify:${user.id}`, 3, 15 * 60_000);
  await sendVerificationEmail(user, requestOrigin(request));
  return Response.json({ ok: true });
});
