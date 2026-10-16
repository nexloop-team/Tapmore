import { DEFAULT_TIME_ZONE } from "@/lib/venue/region";

/** Calendar maths in a venue's own time zone (see venueTimeZone); India unless told otherwise. */

const BUSINESS_TZ = DEFAULT_TIME_ZONE;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localParts(now: Date, timeZone = BUSINESS_TZ): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-IN", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), weekday: WEEKDAYS[parts.weekday] };
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** The local calendar date, e.g. "2026-10-05". */
export function localDate(now: Date, timeZone = BUSINESS_TZ): string {
  const p = localParts(now, timeZone);
  return isoDate(p.year, p.month, p.day);
}

