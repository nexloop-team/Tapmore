import { backedAllergens } from "@/lib/venue/allergen-words";
import { isIndianMenu } from "@/lib/venue/region";
import { menuSectionSchema } from "@/lib/venue/schema";
import { venueFromRequest } from "@/server/dashboard";
import { handle, rateLimit, ServiceError } from "@/server/http";
import { newId } from "@/server/ids";
import { venueHasAccess } from "@/server/repositories/subscriptions";
import { aiImportLimits, importMenu, type MenuFile } from "@/server/services/ai";
import { sniff } from "@/server/services/media";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES: Record<string, MenuFile["mediaType"]> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/**
 * Photos (up to 5) or one PDF of a printed menu → draft sections for the
 * editor. Items whose allergens came from the AI are listed so the editor
 * can ask the owner to check them. Nothing is saved here.
 */
export const POST = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/ai/menu-import">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId, { write: true });
  if (!await venueHasAccess(venue.id)) throw new ServiceError(402, "Your subscription has ended. Renew it on the Billing page to use this.");
  await rateLimit(request, "ai-import", 6);

  let entries: FormDataEntryValue[];
  try {
    entries = (await request.formData()).getAll("files");
  } catch {
    throw new ServiceError(400, "Upload the menu as form data");
  }
  const limits = aiImportLimits();
  const uploads = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (uploads.length === 0) throw new ServiceError(400, limits.pdf ? "Choose at least one photo or PDF of your menu" : "Choose at least one photo of your menu");
  if (uploads.length > Math.min(MAX_FILES, limits.maxImages)) throw new ServiceError(400, `Upload up to ${Math.min(MAX_FILES, limits.maxImages)} photos at a time`);
  if (uploads.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) throw new ServiceError(400, "Files must be under 10 MB in total");

  const files: MenuFile[] = [];
  for (const upload of uploads) {
    const bytes = Buffer.from(await upload.arrayBuffer());
    const isPdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    const image = isPdf ? null : sniff(bytes);
    if (!isPdf && !image) throw new ServiceError(400, `${upload.name || "A file"} isn't a JPEG, PNG, WebP, GIF or PDF`);
    if (isPdf && !limits.pdf) throw new ServiceError(400, "PDF menus can't be read with the current AI setup. Upload photos or screenshots of the pages instead.");
    files.push({ mediaType: isPdf ? "application/pdf" : MEDIA_TYPES[image!], base64: bytes.toString("base64") });
  }
  if (files.filter((file) => file.mediaType === "application/pdf").length > 1) throw new ServiceError(400, "Upload one PDF at a time");

  const imported = await importMenu(venue.id, files);
  const indian = isIndianMenu(venue.config.currencyCode);
  const flaggedItemIds: string[] = [];
  const sections = imported.sections
    .filter((section) => section.items.length > 0)
    .slice(0, 50)
    .map((section, index) => {
      const draft = {
        id: newId("sec").slice(0, 40),
        name: section.name.trim().slice(0, 120) || `Section ${index + 1}`,
        sortOrder: index,
        items: section.items.slice(0, 300).map((item) => {
          const id = newId("itm").slice(0, 40);
          const name = item.name.trim().slice(0, 120) || "Untitled item";
          const description = item.description?.trim().slice(0, 500) || null;
          // Indian menus don't use the 14 allergens; elsewhere, only keep ones the dish's own words back up.
          const allergens = indian ? [] : backedAllergens([...new Set(item.allergens)], `${name} ${description ?? ""}`);
          if (allergens.length > 0) flaggedItemIds.push(id);
          return {
            id,
            name,
            description,
            priceInPence: item.price && item.price > 0 ? Math.min(Math.round(item.price * 100), 10_000_000) : 0,
            isAvailable: true,
            allergens,
            dietaryTags: indian ? [] : [...new Set(item.dietaryTags)],
            foodType: indian ? item.foodType : null,
          };
        }),
      };
      return menuSectionSchema.parse(draft);
    });
  if (sections.length === 0) throw new ServiceError(422, "We couldn't find any dishes in that. Try a clearer, straight-on photo.");
  return Response.json({ sections, flaggedItemIds });
});
