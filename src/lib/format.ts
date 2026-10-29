import { parseDbDate } from "./plans";

const DAY = 86_400_000;

/** "4 Oct 2026" for a DB or ISO timestamp; "–" when missing. */
export function formatDate(value: string | null | undefined): string {
  const time = parseDbDate(value);
  if (time === null) return "–";
  return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Midnight UTC of the day containing `time`. */
function utcDay(time: number): number {
  return Math.floor(time / DAY) * DAY;
}

/** "Today", "Yesterday", "5 days ago", then the date once it's over a month old. */
export function formatAgo(value: string | null | undefined, now = Date.now()): string {
  const time = parseDbDate(value);
  if (time === null) return "–";
  const days = Math.round((utcDay(now) - utcDay(time)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 31) return `${days} days ago`;
  return formatDate(value);
}

/** "just now", "4 min", "2 h", then the day: for the till, where minutes matter. */
export function formatSince(value: string | null | undefined, now = Date.now()): string {
  const time = parseDbDate(value);
  if (time === null) return "–";
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return formatAgo(value, now);
}

/** Counts per UTC day for the last `days` days (oldest first), from a list of timestamps. */
export function dailyCounts(values: (string | null | undefined)[], days: number, now = Date.now()): { day: string; count: number }[] {
  const today = utcDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({ day: new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10), count: 0 }));
  const first = today - (days - 1) * DAY;
  for (const value of values) {
    const time = parseDbDate(value);
    if (time === null || time < first) continue;
    const index = Math.floor((time - first) / DAY);
    if (index >= 0 && index < days) buckets[index].count++;
  }
  return buckets;
}

/** Up to two initials for an avatar: "Ada Lovelace" → "AL", "ada@x.com" → "A". */
export function initials(name: string | null | undefined, fallback = "?"): string {
  const words = (name ?? "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? fallback);
  return letters.toUpperCase();
}

/** "4.5", "4,50", "1,25,000" or "12,500.50" → minor units; anything else → null. */
export function parsePrice(text: string): number | null {
  const trimmed = text.trim().replace(/^[₹$£€]\s*/, "");
  // Commas between groups of digits are thousands (Indian 1,25,000 or 12,500); a lone ",50" is a decimal comma.
  const clean = /^\d{1,3}(,\d{2,3})+(\.\d{0,2})?$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed.replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}
