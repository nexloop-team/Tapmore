import "server-only";
import { getDb } from "../db";

/**
 * Read-only queries behind the merchant dashboard. Scans made from the
 * dashboard's own preview (`s=preview`) are left out of every count.
 */

/** Guests only: not the owner's previews, nor visits by the venue's own team (signed in). */
const GUESTS_ONLY = "COALESCE((params->>'source'), '') != 'preview' AND COALESCE((params->>'team'), '') != '1'";

const DAY_MS = 86_400_000;

/**
 * Where a "last N days" window starts: midnight in the venue's time zone,
 * N-1 days before today. Totals and the daily chart then cover exactly the
 * same days, today included.
 */
export function windowStart(days: number, utcOffsetMinutes = 0, now = Date.now()): string {
  const offset = utcOffsetMinutes * 60_000;
  const localMidnight = Math.floor((now + offset) / DAY_MS) * DAY_MS;
  return new Date(localMidnight - (days - 1) * DAY_MS - offset).toISOString();
}

export interface VenueStats {
  days: number;
  scans: number;
  visitors: number;
  menuViews: number;
  wifiOpens: number;
  reviewTaps: number;
  feedbackCount: number;
  averageSentiment: number | null;
  newGuests: number;
  totalGuests: number;
  members: number;
  stampsHeld: number;
  stampsGiven: number;
  rewardsRedeemed: number;
  daily: { day: string; scans: number }[];
  /** Visits per spot (table), QR scans and NFC taps together. */
  sources: { source: string; scans: number }[];
}

/** A window's headline numbers: everything in VenueStats but the chart and the table list. */
export type VenueTotals = Omit<VenueStats, "days" | "daily" | "sources">;

/**
 * Every headline count for the last `days` days in one round trip: visits
 * and taps from events (a page or menu view counts once per visit, so a
 * refresh isn't a second view), feedback, guests, members and stamps.
 */
export async function venueTotals(venueId: string, days = 30, utcOffsetMinutes = 0): Promise<VenueTotals> {
  const since = windowStart(days, utcOffsetMinutes);
  const row = (await (await getDb()).get(
    `SELECT e.visitors, e.menu_views, e.wifi_opens, e.review_taps, f.n AS feedback_count, f.avg AS feedback_avg,
            g.total AS total_guests, g.recent AS new_guests, c.n AS members, c.stamps AS stamps_held,
            s.stamps AS stamps_given, s.redeemed AS rewards_redeemed
       FROM (SELECT COUNT(DISTINCT (params->>'session_id')) FILTER (WHERE name = 'landing_opened') AS visitors,
                    COUNT(DISTINCT (params->>'session_id')) FILTER (WHERE name = 'menu_viewed') AS menu_views,
                    COUNT(*) FILTER (WHERE name = 'wifi_sheet_opened') AS wifi_opens,
                    COUNT(*) FILTER (WHERE name = 'google_review_tapped') AS review_taps
               FROM events
              WHERE venue_id = ? AND name IN ('landing_opened', 'menu_viewed', 'wifi_sheet_opened', 'google_review_tapped')
                AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}) e,
            (SELECT COUNT(*) AS n, AVG(sentiment) AS avg FROM feedback WHERE venue_id = ? AND created_at >= CAST(? AS TIMESTAMPTZ)) f,
            (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at >= CAST(? AS TIMESTAMPTZ)) AS recent FROM customers WHERE venue_id = ?) g,
            (SELECT COUNT(*) AS n, COALESCE(SUM(stamps), 0) AS stamps FROM loyalty_cards WHERE venue_id = ?) c,
            (SELECT COALESCE(SUM(CASE WHEN kind = 'stamp' THEN delta END), 0) AS stamps, COUNT(CASE WHEN kind = 'redeem' THEN 1 END) AS redeemed
               FROM stamp_events WHERE venue_id = ? AND undone_at IS NULL AND created_at >= CAST(? AS TIMESTAMPTZ)) s`,
    venueId, since, venueId, since, since, venueId, venueId, venueId, since,
  )) as {
    visitors: number; menu_views: number; wifi_opens: number; review_taps: number; feedback_count: number; feedback_avg: number | null;
    total_guests: number; new_guests: number; members: number; stamps_held: number; stamps_given: number; rewards_redeemed: number;
  };
  return {
    scans: row.visitors,
    visitors: row.visitors,
    menuViews: row.menu_views,
    wifiOpens: row.wifi_opens,
    reviewTaps: row.review_taps,
    feedbackCount: row.feedback_count,
    averageSentiment: row.feedback_avg,
    newGuests: row.new_guests ?? 0,
    totalGuests: row.total_guests,
    members: row.members,
    stampsHeld: row.stamps_held,
    stampsGiven: row.stamps_given,
    rewardsRedeemed: row.rewards_redeemed,
  };
}

/**
 * A scan is a visit: one guest opening the page counts once, however many
 * times they refresh or go to the menu and back (see lib/analytics visitId).
 * Days are the venue's own, given its offset from UTC in minutes. The
 * totals, the daily chart and the table list are fetched side by side.
 */
export async function venueStats(venueId: string, days = 30, utcOffsetMinutes = 0): Promise<VenueStats> {
  const db = await getDb();
  const since = windowStart(days, utcOffsetMinutes);
  const local = `${utcOffsetMinutes >= 0 ? "+" : "-"}${Math.abs(utcOffsetMinutes)} minutes`;
  const [totals, dailyRows, sources] = await Promise.all([
    venueTotals(venueId, days, utcOffsetMinutes),
    db.all(
      `SELECT to_char((created_at + CAST(? AS INTERVAL)) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(DISTINCT (params->>'session_id')) AS scans FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}
       GROUP BY 1`, local, venueId, since) as Promise<unknown> as Promise<{ day: string; scans: number }[]>,
    // A table's QR ("table-4") and NFC tag ("table-4-nfc") count as one spot; an unnamed NFC tag ("nfc") belongs to the main code.
    db.all(
      `SELECT base AS source, COUNT(DISTINCT session_id) AS scans FROM (
         SELECT CASE WHEN src = 'nfc' THEN 'unknown' WHEN src LIKE '%-nfc' THEN left(src, length(src) - 4) ELSE src END AS base, session_id
           FROM (SELECT COALESCE((params->>'source'), 'unknown') AS src, (params->>'session_id') AS session_id FROM events
                  WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}) AS opened
       ) AS spots
       GROUP BY base ORDER BY scans DESC LIMIT 8`, venueId, since) as Promise<unknown> as Promise<{ source: string; scans: number }[]>,
  ]);
  const byDay = new Map(dailyRows.map((row) => [row.day, row.scans]));
  const daily: VenueStats["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() + utcOffsetMinutes * 60_000 - i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ day, scans: byDay.get(day) ?? 0 });
  }
  return { days, ...totals, daily, sources };
}

export interface VenueEngagement {
  /** Visits that opened each card on the guest page ("menu", "wifi", "loyalty"…). */
  features: { feature: string; visits: number }[];
  /** Visits by the venue's local hour, 0–23. */
  hours: number[];
  /** The dishes guests opened most on the menu. */
  dishes: { itemId: string; opens: number }[];
}

/** What guests do once they're on the page: which cards they open, when they come, which dishes they look at. */
export async function venueEngagement(venueId: string, days = 30, utcOffsetMinutes = 0): Promise<VenueEngagement> {
  const db = await getDb();
  const since = windowStart(days, utcOffsetMinutes);
  const local = `${utcOffsetMinutes >= 0 ? "+" : "-"}${Math.abs(utcOffsetMinutes)} minutes`;
  const [features, hourRows, dishes] = (await Promise.all([
    db.all(
      `SELECT (params->>'feature') AS feature, COUNT(DISTINCT (params->>'session_id')) AS visits FROM events
       WHERE venue_id = ? AND name = 'feature_card_tapped' AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}
       GROUP BY feature ORDER BY visits DESC`, venueId, since),
    db.all(
      `SELECT CAST(EXTRACT(HOUR FROM (created_at + CAST(? AS INTERVAL)) AT TIME ZONE 'UTC') AS INTEGER) AS hour, COUNT(DISTINCT (params->>'session_id')) AS visits FROM events
       WHERE venue_id = ? AND name = 'landing_opened' AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}
       GROUP BY 1`, local, venueId, since),
    db.all(
      `SELECT (params->>'item_id') AS "itemId", COUNT(DISTINCT (params->>'session_id')) AS opens FROM events
       WHERE venue_id = ? AND name = 'menu_item_opened' AND created_at >= CAST(? AS TIMESTAMPTZ) AND ${GUESTS_ONLY}
       GROUP BY 1 ORDER BY opens DESC LIMIT 5`, venueId, since),
  ])) as unknown as [{ feature: string; visits: number }[], { hour: number; visits: number }[], { itemId: string; opens: number }[]];
  const hours = new Array<number>(24).fill(0);
  for (const row of hourRows) hours[row.hour] = row.visits;
  return { features: features.filter((f) => f.feature), hours, dishes: dishes.filter((d) => d.itemId) };
}

export interface GuestRow {
  id: string;
  email: string;
  firstName: string | null;
  name: string | null;
  captureSource: string | null;
  marketingConsent: string;
  birthday: string | null;
  stamps: number | null;
  visits: number;
  createdAt: string;
}

export async function listGuests(venueId: string, options: { query?: string; limit?: number; offset?: number } = {}): Promise<{ rows: GuestRow[]; total: number }> {
  const db = await getDb();
  const query = (options.query ?? "").trim().toLowerCase();
  const filter = query ? "AND (c.email ILIKE ? OR LOWER(COALESCE(c.first_name, '') || ' ' || COALESCE(c.name, '')) LIKE ?)" : "";
  const filterArgs = query ? [`%${query}%`, `%${query}%`] : [];
  const total = ((await db.get(`SELECT COUNT(*) AS n FROM customers c WHERE c.venue_id = ? ${filter}`, venueId, ...filterArgs)) as { n: number }).n;
  const rows = (await db.all(
      `SELECT c.*, l.stamps,
              (SELECT COUNT(*) FROM visits v WHERE v.customer_id = c.id) AS visit_count
       FROM customers c LEFT JOIN loyalty_cards l ON l.customer_id = c.id
       WHERE c.venue_id = ? ${filter}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, venueId, ...filterArgs, options.limit ?? 50, options.offset ?? 0)) as {
    id: string;
    email: string;
    first_name: string | null;
    name: string | null;
    capture_source: string | null;
    marketing_consent: string;
    birthday_month: number | null;
    birthday_day: number | null;
    stamps: number | null;
    visit_count: number;
    created_at: string;
  }[];
  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      name: row.name,
      captureSource: row.capture_source,
      marketingConsent: row.marketing_consent,
      birthday: row.birthday_month && row.birthday_day ? `${String(row.birthday_day).padStart(2, "0")}/${String(row.birthday_month).padStart(2, "0")}` : null,
      stamps: row.stamps,
      visits: row.visit_count,
      createdAt: row.created_at,
    })),
  };
}

export interface FeedbackRow {
  id: string;
  text: string;
  sentiment: number;
  source: string | null;
  hasPhoto: boolean;
  createdAt: string;
}

export type FeedbackFilter = "all" | "positive" | "neutral" | "negative";

const SENTIMENT_WHERE: Record<FeedbackFilter, string> = {
  all: "",
  positive: "AND sentiment >= 0.25",
  neutral: "AND sentiment > -0.25 AND sentiment < 0.25",
  negative: "AND sentiment <= -0.25",
};

export async function listFeedback(venueId: string, options: { filter?: FeedbackFilter; limit?: number; offset?: number } = {}): Promise<{ rows: FeedbackRow[]; total: number }> {
  const db = await getDb();
  const where = SENTIMENT_WHERE[options.filter ?? "all"];
  const total = ((await db.get(`SELECT COUNT(*) AS n FROM feedback WHERE venue_id = ? ${where}`, venueId)) as { n: number }).n;
  const rows = (await db.all(`SELECT id, text, sentiment, source, image_path, created_at FROM feedback WHERE venue_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, venueId, options.limit ?? 30, options.offset ?? 0)) as {
    id: string;
    text: string;
    sentiment: number;
    source: string | null;
    image_path: string | null;
    created_at: string;
  }[];
  return {
    total,
    rows: rows.map((row) => ({ id: row.id, text: row.text, sentiment: row.sentiment, source: row.source, hasPhoto: !!row.image_path, createdAt: row.created_at })),
  };
}

export async function feedbackPhotoPath(venueId: string, feedbackId: string): Promise<string | null> {
  const row = (await (await getDb()).get("SELECT image_path FROM feedback WHERE venue_id = ? AND id = ?", venueId, feedbackId)) as { image_path: string | null } | undefined;
  return row?.image_path ?? null;
}
