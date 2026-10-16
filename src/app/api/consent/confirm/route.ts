import { getDb } from "@/server/db";
import { rateLimit } from "@/server/http";
import { confirmConsent } from "@/server/services/consent";

/**
 * The Confirm button on /consent. A POST, because email scanners open links
 * (GET) before people do, and a scanner must not say yes for the guest.
 */
export async function POST(request: Request) {
  await rateLimit(request, "consent", 30);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const confirmed = token.length > 0 && await confirmConsent(await getDb(), token);
  return Response.redirect(new URL(`/consent?status=${confirmed ? "confirmed" : "invalid"}`, request.url), 303);
}

/** Links in emails sent before the button existed: show the button instead of confirming. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return Response.redirect(new URL(`/consent?token=${encodeURIComponent(token)}`, request.url), 303);
}
