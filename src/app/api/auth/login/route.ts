import { cookies } from "next/headers";
import { loginRequest } from "@/lib/api/account-contracts";
import { assertSameOrigin, clientIp, handle, parseBody } from "@/server/http";
import { homeAfterLogin, login } from "@/server/services/accounts";

/** Signs in; answers with where to go next (`home`), so the browser goes straight there. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const user = await login(await parseBody(request, loginRequest), clientIp(request));
  return Response.json({ ok: true, home: await homeAfterLogin(user.id, (await cookies()).get("tt_venue")?.value) });
});
