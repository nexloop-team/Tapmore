import { venueFromRequest } from "@/server/dashboard";
import { handle } from "@/server/http";
import { listGuests } from "@/server/repositories/insights";

/** Spreadsheet apps execute cells starting with these; prefix them so a guest's name can't become a formula. */
function cell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GET = handle(async (request, ctx: RouteContext<"/api/dashboard/venues/[venueId]/guests/export">) => {
  const { venue } = await venueFromRequest(request, (await ctx.params).venueId);
  const { rows } = await listGuests(venue.id, { limit: 100_000 });
  const header = ["email", "first_name", "name", "birthday_dd_mm", "stamps", "visits", "source", "joined_utc"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([row.email, row.firstName, row.name, row.birthday, row.stamps, row.visits, row.captureSource, row.createdAt].map(cell).join(","));
  }
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${venue.shortCode}-guests.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
