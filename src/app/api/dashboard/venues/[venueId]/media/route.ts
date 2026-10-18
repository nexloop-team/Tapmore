import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit, ServiceError } from "@/server/http";
import { isMediaKind, saveVenueMedia } from "@/server/services/media";

/** Multipart upload of one image (`file`, and `kind`: logo, cover or dish); answers with its public URL. */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/media">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  await rateLimit(request, "media", 30);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ServiceError(400, "Upload the image as form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ServiceError(400, "Choose an image to upload");
  const kind = form.get("kind");
  return Response.json({ url: await saveVenueMedia(venue.id, file, isMediaKind(kind) ? kind : "cover") });
});
