import { businessProfile } from "@/lib/venue/business";
import { isIndianMenu } from "@/lib/venue/region";
import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit, ServiceError } from "@/server/http";
import { venueHasAccess } from "@/server/repositories/subscriptions";
import { importMenu } from "@/server/services/ai";
import { importedSections, menuImportForm, menuUploads } from "@/server/services/menu-import";

/**
 * Photos (up to 5) or one PDF of a printed menu → draft sections for the
 * editor. Items whose allergens came from the AI are listed so the editor
 * can ask the owner to check them. Nothing is saved here.
 */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/ai/menu-import">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  if (!await venueHasAccess(venue.id)) throw new ServiceError(402, "Your subscription has ended. Renew it on the Billing page to use this.");
  await rateLimit(request, "ai-import", 6);
  const files = await menuUploads(await menuImportForm(request));

  // Shops and services import a price list: no allergens, dietary tags or veg marks.
  const food = businessProfile(venue.config.venueType).foodFields;
  const imported = await importMenu(venue.id, files, food);
  return Response.json(importedSections(imported, food, food && isIndianMenu(venue.config.currencyCode)));
});
