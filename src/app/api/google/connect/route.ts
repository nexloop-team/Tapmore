import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { requestOrigin, ServiceError } from "@/server/http";
import { startConnect } from "@/server/services/reviews";

/** `/api/google/connect?venue=<id>`: sends the owner to Google's consent page for this venue. */
export async function GET(request: Request) {
  const venueId = new URL(request.url).searchParams.get("venue") ?? "";
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/api/google/connect?venue=${venueId}`)}`);
  let url: string;
  try {
    url = await startConnect(user, venueId, requestOrigin(request));
  } catch (error) {
    if (error instanceof ServiceError) redirect(`/dashboard/${encodeURIComponent(venueId)}/reviews?google=error&reason=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(url);
}
