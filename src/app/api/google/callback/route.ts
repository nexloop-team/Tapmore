import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requestOrigin, ServiceError } from "@/server/http";
import { completeConnect } from "@/server/services/reviews";

/**
 * Google sends the owner back here after the consent page. A cross-site
 * redirect, so no same-origin check: the one-time state (this user, this
 * venue) and the membership check in completeConnect protect it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const venueId = state.split("~")[1] ?? "";
  const back = (query: string) => (venueId ? `/dashboard/${encodeURIComponent(venueId)}/reviews?${query}` : "/dashboard");
  // "Cancel" on Google's page.
  if (url.searchParams.get("error") || !code) redirect(back("google=cancelled"));
  const user = await currentUser();
  if (!user) redirect("/login");
  try {
    await completeConnect(user, code, state, requestOrigin(request));
  } catch (error) {
    if (error instanceof ServiceError) redirect(back(`google=error&reason=${encodeURIComponent(error.message)}`));
    throw error;
  }
  redirect(back("google=connected"));
}
