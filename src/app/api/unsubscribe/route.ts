import { rateLimit } from "@/server/http";
import { findByUnsubscribeToken, unsubscribe } from "@/server/repositories/retention";

/**
 * Unsubscribe from a venue's birthday emails. Used by the button on /unsubscribe and
 * by mail apps' one-click unsubscribe (RFC 8058), which POST to the
 * List-Unsubscribe URL with the token in the query string.
 */
export async function POST(request: Request) {
  await rateLimit(request, "unsubscribe", 30);
  let token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") ?? "");
  }
  const guest = token ? await findByUnsubscribeToken(token) : null;
  if (guest) await unsubscribe(guest.customerId);
  // Same answer either way, so tokens can't be probed.
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") && !new URL(request.url).searchParams.get("token")) {
    return Response.redirect(new URL("/unsubscribe?done=1", request.url), 303);
  }
  return new Response(null, { status: 204 });
}
