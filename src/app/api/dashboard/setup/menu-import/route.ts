import { businessProfile } from "@/lib/venue/business";
import { isIndianMenu } from "@/lib/venue/region";
import { requireApiUser } from "@/server/auth/session";
import { assertSameOrigin, handle, rateLimit } from "@/server/http";
import { importMenu } from "@/server/services/ai";
import { importedSections, menuImportForm, menuUploads } from "@/server/services/menu-import";

/**
 * The setup wizard's "Import from a photo": the business doesn't exist yet,
 * so this reads for the signed-in owner (AI use counted against them) and
 * takes the business type and currency from the form. Nothing is saved: the
 * items come back into the wizard for the owner to check.
 */
export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await rateLimit(request, "ai-import", 6);
  const form = await menuImportForm(request);
  const files = await menuUploads(form);

  const food = businessProfile(String(form.get("venueType") ?? "")).foodFields;
  const imported = await importMenu(`setup:${user.id}`, files, food);
  return Response.json(importedSections(imported, food, food && isIndianMenu(String(form.get("currencyCode") ?? ""))));
});
