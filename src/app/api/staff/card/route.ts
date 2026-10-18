import { handle, rateLimitLocal } from "@/server/http";
import { requireStaffDevice, viewCard } from "@/server/services/staff";

/**
 * One card, for a paired till: what the till shows right after a scan,
 * without loading a new page (see components/staff/TillCardHost).
 */
export const GET = handle(async (request) => {
  rateLimitLocal(request, "staff-card", 120);
  const device = await requireStaffDevice();
  const cardId = new URL(request.url).searchParams.get("c") ?? "";
  return Response.json(await viewCard(device, cardId), { headers: { "Cache-Control": "no-store" } });
});
