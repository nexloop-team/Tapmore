import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit, ServiceError } from "@/server/http";
import { saveVenueMedia } from "@/server/services/media";

/** Multipart upload of one image (`file`); answers with its public URL. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/media">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "media", 30);
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    throw new ServiceError(400, "Upload the image as form data");
  }
  if (!(file instanceof File)) throw new ServiceError(400, "Choose an image to upload");
  return Response.json({ url: await saveVenueMedia(venue.id, file) });
});
