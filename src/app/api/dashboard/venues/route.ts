import { createVenueRequest } from "@/lib/venue/schema";
import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, parseBody, rateLimit } from "@/server/http";
import { createVenueForUser } from "@/server/services/venue-admin";

/** Onboarding: creates a venue owned by the signed-in merchant, with the free trial running. */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await rateLimit(request, "create-venue", 10);
  const user = await requireApiUser();
  const venue = await createVenueForUser(user, await parseBody(request, createVenueRequest));
  return Response.json({ id: venue.id, shortCode: venue.shortCode });
});
