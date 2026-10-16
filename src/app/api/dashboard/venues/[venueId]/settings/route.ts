import { applySettingsPatch, venueSettingsPatch, venueSettingsSchema } from "@/lib/venue/settings";
import { venueFromRequest } from "@/server/dashboard";
import { handle, parseBody, ServiceError } from "@/server/http";
import { getVenueSettings, saveVenueSettings } from "@/server/repositories/venues";

/** Owner-only settings (stamp policy, birthday reward); only the fields sent change. */
export const PATCH = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/settings">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  const patch = await parseBody(request, venueSettingsPatch);
  const merged = venueSettingsSchema.safeParse(applySettingsPatch(await getVenueSettings(venue.id), patch));
  if (!merged.success) throw new ServiceError(400, merged.error.issues[0]?.message ?? "Invalid settings");
  await saveVenueSettings(venue.id, merged.data);
  return Response.json(merged.data);
});
