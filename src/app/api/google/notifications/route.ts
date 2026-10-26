import { timingSafeEqual } from "node:crypto";
import { afterResponse } from "@/server/after";
import { handleGoogleAlert } from "@/server/services/reviews";

/**
 * Google's new-review alerts, pushed by Cloud Pub/Sub to
 * `/api/google/notifications?token=<GOOGLE_PUSH_TOKEN>`. Answered at once
 * (Pub/Sub retries anything that isn't 2xx); the venue's reviews are read
 * after the response.
 */
export async function POST(request: Request) {
  const expected = Buffer.from(process.env.GOOGLE_PUSH_TOKEN?.trim() ?? "");
  const given = Buffer.from(new URL(request.url).searchParams.get("token") ?? "");
  if (expected.length === 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { message?: { data?: string } } | null;
  let data: unknown = null;
  try {
    data = JSON.parse(Buffer.from(body?.message?.data ?? "", "base64").toString("utf8"));
  } catch {
    return new Response(null, { status: 204 });
  }
  await afterResponse("google review alert", () => handleGoogleAlert(data));
  return new Response(null, { status: 204 });
}
