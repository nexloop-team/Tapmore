import "server-only";
import { TRIAL_DAYS } from "@/lib/plans";
import { liveAnnouncement } from "@/lib/venue/features";
import { venueTimeZone } from "@/lib/venue/region";
import { localDate } from "../jobs/time";
import type { VenueConfig } from "@/lib/venue/schema";
import { resolveSettings, type VenueSettings } from "@/lib/venue/settings";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { DEMO_VENUE_IDS, demoVenue } from "../seed";
import { storage, storageKey } from "../storage";
import { startTrial, venueHasAccess } from "./subscriptions";

export type VenueStatus = "active" | "suspended";

interface VenueRow {
  id: string;
  short_code: string;
  config: string;
  status: VenueStatus;
  created_at: string;
  updated_at: string | null;
}

function toVenue(row: VenueRow): PublicVenue {
  const config = JSON.parse(row.config) as Omit<PublicVenue, "id" | "shortCode">;
  return {
    ...config,
    id: row.id,
    shortCode: row.short_code,
    socialLinks: config.socialLinks ?? {},
    menus: config.menus ?? [],
    externalLinks: config.externalLinks ?? [],
    branding: config.branding ?? {},
    crm: {
      enabled: !!config.crm?.enabled,
      wifiCapture: !!config.crm?.wifiCapture,
      feedbackCapture: !!config.crm?.feedbackCapture,
      birthdayAsk: !!config.crm?.birthdayAsk,
    },
  };
}

/**
 * The venue an id, a short code or one of its earlier short codes names:
 * after a change of page address, QR codes already printed still lead to
 * the same venue (and never to anyone else's).
 */
async function findVenueRow(idOrCode: string): Promise<VenueRow | undefined> {
  const db = await getDb();
  const row = (await db.get("SELECT * FROM venues WHERE id = ? OR short_code = ? LIMIT 1", idOrCode, idOrCode)) as VenueRow | undefined;
  if (row) return row;
  return (await db.get("SELECT v.* FROM retired_codes r JOIN venues v ON v.id = r.venue_id WHERE r.code = ?", idOrCode)) as VenueRow | undefined;
}

/**
 * Accepts the canonical id or the short code printed in QR codes. This is the
 * guest-facing lookup: suspended venues and venues without a paid
 * subscription or running trial don't resolve, so their pages go offline.
 */
export async function findVenue(idOrCode: string): Promise<PublicVenue | null> {
  // The demos are always live and their content lives in code: no database round trip.
  const demo = demoVenue(idOrCode);
  if (demo) return { ...demo, announcement: liveAnnouncement(demo.announcement, localDate(new Date(), venueTimeZone(demo.currencyCode))) };
  const row = await findVenueRow(idOrCode);
  if (!row || row.status !== "active" || !await venueHasAccess(row.id)) return null;
  const venue = toVenue(row);
  return { ...venue, announcement: liveAnnouncement(venue.announcement, localDate(new Date(), venueTimeZone(venue.currencyCode))) };
}

/**
 * A venue whose page is switched off (suspended, or no subscription or trial
 * left): just enough to show a "Back soon" page in its own colours. Null
 * when the code doesn't belong to any venue.
 */
export async function findPausedVenue(idOrCode: string): Promise<{ name: string; branding: PublicVenue["branding"] } | null> {
  const row = await findVenueRow(idOrCode);
  if (!row || (row.status === "active" && await venueHasAccess(row.id))) return null;
  const venue = toVenue(row);
  return { name: venue.name, branding: venue.branding };
}

/** The merchant's own view: the saved configuration, whatever the plan. */
export interface VenueRecord {
  id: string;
  shortCode: string;
  status: VenueStatus;
  config: VenueConfig;
  createdAt: string;
  updatedAt: string | null;
}

function toRecord(row: VenueRow): VenueRecord {
  const { id, shortCode, ...config } = toVenue(row);
  return { id, shortCode, status: row.status, config: config as VenueConfig, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getVenueRecord(venueId: string): Promise<VenueRecord | null> {
  const row = (await (await getDb()).get("SELECT * FROM venues WHERE id = ?", venueId)) as VenueRow | undefined;
  return row ? toRecord(row) : null;
}

/** Venues this user runs (owner, or any future manager role). Staff memberships are listed separately. */
export async function listVenuesForUser(userId: string): Promise<VenueRecord[]> {
  const rows = (await (await getDb()).all("SELECT v.* FROM venues v JOIN venue_members m ON m.venue_id = v.id WHERE m.user_id = ? AND m.role != 'staff' ORDER BY v.created_at", userId)) as unknown as VenueRow[];
  return rows.map(toRecord);
}

/** Venues where this user is staff: they can open the till there and nothing else. */
export async function listStaffVenuesForUser(userId: string): Promise<VenueRecord[]> {
  const rows = (await (await getDb()).all("SELECT v.* FROM venues v JOIN venue_members m ON m.venue_id = v.id WHERE m.user_id = ? AND m.role = 'staff' ORDER BY v.created_at", userId)) as unknown as VenueRow[];
  return rows.map(toRecord);
}

export async function venueRole(userId: string, venueId: string): Promise<string | null> {
  const row = (await (await getDb()).get("SELECT role FROM venue_members WHERE user_id = ? AND venue_id = ?", userId, venueId)) as { role: string } | undefined;
  return row?.role ?? null;
}

/** Can see and change the venue's dashboard: any membership except staff. */
export function isManagerRole(role: string | null): boolean {
  return role !== null && role !== "staff";
}

export interface StaffMember {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
}

export async function listStaffMembers(venueId: string): Promise<StaffMember[]> {
  const rows = (await (await getDb()).all(
      `SELECT u.id, u.name, u.email, m.created_at FROM venue_members m JOIN users u ON u.id = m.user_id
        WHERE m.venue_id = ? AND m.role = 'staff' ORDER BY m.created_at`, venueId)) as { id: string; name: string; email: string; created_at: string }[];
  return rows.map((row) => ({ userId: row.id, name: row.name, email: row.email, joinedAt: row.created_at }));
}

/** Adds a staff membership; someone who's already a member keeps their existing role. */
export async function addStaffMember(venueId: string, userId: string) {
  (await (await getDb()).run("INSERT INTO venue_members (venue_id, user_id, role) VALUES (?, ?, 'staff') ON CONFLICT DO NOTHING", venueId, userId));
}

/** Removes a staff login and locks any till device that login opened. */
export async function removeStaffMember(venueId: string, userId: string): Promise<boolean> {
  return await transaction(async (db) => {
    const result = (await db.run("DELETE FROM venue_members WHERE venue_id = ? AND user_id = ? AND role = 'staff'", venueId, userId));
    if (Number(result.changes) === 0) return false;
    (await db.run("UPDATE staff_devices SET revoked_at = now() WHERE venue_id = ? AND user_id = ? AND revoked_at IS NULL", venueId, userId));
    return true;
  });
}

/** In use as a venue's id or code, or retired by another (or a deleted) venue. A venue may take back its own old code. */
export async function shortCodeTaken(code: string, exceptVenueId = ""): Promise<boolean> {
  const db = await getDb();
  if (await db.get("SELECT 1 FROM venues WHERE (short_code = ? OR id = ?) AND id != ?", code, code, exceptVenueId)) return true;
  return !!(await db.get("SELECT 1 FROM retired_codes WHERE code = ? AND (venue_id IS NULL OR venue_id != ?)", code, exceptVenueId));
}

export async function createVenue(input: { id: string; shortCode: string; ownerId: string; config: VenueConfig }) {
  await transaction(async (db) => {
    (await db.run("INSERT INTO venues (id, short_code, config, updated_at) VALUES (?, ?, ?, now())", input.id,
      input.shortCode,
      JSON.stringify(input.config),));
    (await db.run("INSERT INTO venue_members (venue_id, user_id, role) VALUES (?, ?, 'owner')", input.id, input.ownerId));
    await startTrial(db, input.id, TRIAL_DAYS);
  });
}

/** Saves a new config and keeps the one it replaces, so the last save can be undone. */
export async function updateVenueConfig(venueId: string, config: VenueConfig) {
  (await (await getDb()).run("UPDATE venues SET previous_config = config, config = ?, updated_at = now() WHERE id = ?", JSON.stringify(config), venueId));
}

/**
 * Swaps the config with the one before the last save. Doing it twice redoes
 * the save. Returns false when there's nothing to go back to.
 */
export async function restorePreviousConfig(venueId: string): Promise<boolean> {
  const result = (await (await getDb()).run("UPDATE venues SET config = previous_config, previous_config = config, updated_at = now() WHERE id = ? AND previous_config IS NOT NULL", venueId));
  return Number(result.changes) > 0;
}

/** Changes the page address; the old one keeps leading here (see findVenueRow). */
export async function updateShortCode(venueId: string, shortCode: string) {
  await transaction(async (db) => {
    (await db.run(
      "INSERT INTO retired_codes (code, venue_id) SELECT short_code, id FROM venues WHERE id = ? ON CONFLICT (code) DO UPDATE SET venue_id = excluded.venue_id, retired_at = now()", venueId));
    (await db.run("DELETE FROM retired_codes WHERE code = ? AND venue_id = ?", shortCode, venueId));
    (await db.run("UPDATE venues SET short_code = ?, updated_at = now() WHERE id = ?", shortCode, venueId));
  });
}

/** Owner-only settings (stamp policy, automations), with defaults filled in. */
export async function getVenueSettings(venueId: string): Promise<VenueSettings> {
  const row = (await (await getDb()).get("SELECT settings FROM venues WHERE id = ?", venueId)) as { settings: string | null } | undefined;
  return resolveSettings(row?.settings ? JSON.parse(row.settings) : null);
}

export async function saveVenueSettings(venueId: string, settings: VenueSettings) {
  (await (await getDb()).run("UPDATE venues SET settings = ?, updated_at = now() WHERE id = ?", JSON.stringify(settings), venueId));
}

export async function setVenueStatus(venueId: string, status: VenueStatus) {
  (await (await getDb()).run("UPDATE venues SET status = ?, updated_at = now() WHERE id = ?", status, venueId));
}

/** Removes the venue and everything its guests gave it: data, photos and media. */
export async function deleteVenue(venueId: string) {
  const photos = (await (await getDb()).all("SELECT image_path FROM feedback WHERE venue_id = ? AND image_path IS NOT NULL", venueId)) as { image_path: string }[];
  await transaction(async (db) => {
    (await db.run("DELETE FROM guest_emails WHERE customer_id IN (SELECT id FROM customers WHERE venue_id = ?)", venueId));
    for (const table of ["visits", "stamp_events", "loyalty_cards", "customers", "feedback", "events", "ai_usage", "venue_members", "subscriptions"]) {
      (await db.run(`DELETE FROM ${table} WHERE venue_id = ?`, venueId));
    }
    // Its page addresses stay reserved, so printed QR codes can never lead to another venue.
    (await db.run("INSERT INTO retired_codes (code, venue_id) SELECT short_code, NULL FROM venues WHERE id = ? ON CONFLICT (code) DO UPDATE SET venue_id = NULL", venueId));
    (await db.run("DELETE FROM venues WHERE id = ?", venueId));
  });
  for (const photo of photos) {
    const key = storageKey(photo.image_path);
    if (key) await storage().remove(key);
  }
  await storage().remove(`media/${venueId}/`);
}

/** Venues where this user is the only owner, which go with the account. */
export async function venuesOwnedSolelyBy(userId: string): Promise<string[]> {
  const rows = (await (await getDb()).all(
      `SELECT m.venue_id FROM venue_members m
       WHERE m.user_id = ? AND m.role = 'owner'
         AND NOT EXISTS (SELECT 1 FROM venue_members o WHERE o.venue_id = m.venue_id AND o.user_id != m.user_id AND o.role = 'owner')`, userId)) as { venue_id: string }[];
  return rows.map((row) => row.venue_id);
}

export interface AdminVenueRow {
  id: string;
  shortCode: string;
  name: string;
  status: VenueStatus;
  createdAt: string;
  ownerEmail: string | null;
  paid: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  provider: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionUpdatedAt: string | null;
  guests: number;
  /** Guest page opens in the last 7 days, not counting the owner's own previews. */
  scans7d: number;
  lastScanAt: string | null;
}

export async function listVenuesForAdmin(limit = 500): Promise<AdminVenueRow[]> {
  const rows = (await (await getDb()).all(
      `SELECT v.id, v.short_code, (v.config::jsonb->>'name') AS name, v.status, v.created_at,
              (SELECT u.email FROM venue_members m JOIN users u ON u.id = m.user_id WHERE m.venue_id = v.id AND m.role = 'owner' LIMIT 1) AS owner_email,
              s.plan, s.status AS sub_status, s.trial_ends_at, s.current_period_end, s.provider, s.cancel_at_period_end, s.updated_at AS sub_updated_at,
              (SELECT COUNT(*) FROM customers c WHERE c.venue_id = v.id) AS guests,
              (SELECT COUNT(DISTINCT (e.params->>'session_id')) FROM events e WHERE e.venue_id = v.id AND e.name = 'landing_opened' AND e.created_at >= now() + INTERVAL '-7 days'
                 AND COALESCE((e.params->>'source'), '') != 'preview' AND COALESCE((e.params->>'team'), '') != '1') AS scans_7d,
              (SELECT MAX(e.created_at) FROM events e WHERE e.venue_id = v.id AND e.name = 'landing_opened'
                 AND COALESCE((e.params->>'source'), '') != 'preview' AND COALESCE((e.params->>'team'), '') != '1') AS last_scan_at
       FROM venues v LEFT JOIN subscriptions s ON s.venue_id = v.id
       WHERE NOT (v.id = ANY(?))
       ORDER BY v.created_at DESC LIMIT ?`, DEMO_VENUE_IDS, limit)) as {
    id: string;
    short_code: string;
    name: string;
    status: VenueStatus;
    created_at: string;
    owner_email: string | null;
    plan: string | null;
    sub_status: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    provider: string | null;
    cancel_at_period_end: number | null;
    sub_updated_at: string | null;
    guests: number;
    scans_7d: number;
    last_scan_at: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    shortCode: row.short_code,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    ownerEmail: row.owner_email,
    paid: row.plan === "pro",
    subscriptionStatus: row.sub_status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    provider: row.provider,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    subscriptionUpdatedAt: row.sub_updated_at,
    guests: row.guests,
    scans7d: row.scans_7d,
    lastScanAt: row.last_scan_at,
  }));
}
