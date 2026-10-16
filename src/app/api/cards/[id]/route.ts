import { transaction } from "@/server/db";
import { assertSameOrigin, handle, rateLimit, rateLimitLocal, requestOrigin, ServiceError } from "@/server/http";
import { deleteGuest } from "@/server/repositories/customers";
import { publicOrigin } from "@/server/services/qr";
import { memberCardView } from "@/server/services/card";

/**
 * The member's card for whoever holds its private link (id + token). The
 * venue's guest page shows it inline, and both it and the card page poll
 * this to show new stamps the moment staff add them.
 */
export const GET = handle(async (request, ctx: RouteContext<"/api/cards/[id]">) => {
  rateLimitLocal(request, "card-status", 120);
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const view = await memberCardView(id, token, publicOrigin(requestOrigin(request)));
  if (!view) throw new ServiceError(404, "Card not found");
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
});

/** The member deletes their own card and details (the link is their proof): withdrawing is as easy as joining. */
export const DELETE = handle(async (request, ctx: RouteContext<"/api/cards/[id]">) => {
  assertSameOrigin(request);
  await rateLimit(request, "card-delete", 10);
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const deleted = token
    ? await transaction(async (db) => {
        const card = (await db.get("SELECT venue_id, customer_id FROM loyalty_cards WHERE id = ? AND access_token = ?", id, token)) as
          | { venue_id: string; customer_id: string }
          | undefined;
        return card ? await deleteGuest(db, card.venue_id, card.customer_id) : false;
      })
    : false;
  if (!deleted) throw new ServiceError(404, "Card not found");
  return Response.json({ ok: true });
});
