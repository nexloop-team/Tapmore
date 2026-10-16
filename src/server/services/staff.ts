import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { StaffCardView, StaffEnrollRequest, StaffEnrollResponse } from "@/lib/api/staff-contracts";
import { isPlausibleEmail, isValidBirthday, maskEmail, normaliseEmail } from "@/lib/validation";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import { birthdayAskOn, hasLoyaltyProgram } from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { ServiceError } from "../http";
import { newToken } from "../ids";
import { findCardById, lockCard, setCardStamps, type LoyaltyCardRow } from "../repositories/loyalty-cards";
import { lastStaffStampAt, lastUndoableEvent, markUndone, recordStampEvent } from "../repositories/stamps";
import { findVenue, getVenueSettings } from "../repositories/venues";
import { onStaffStamp } from "./retention";
import { parseDbDate } from "@/lib/plans";
import { birthdayTreat } from "./birthday";
import { enroll } from "./loyalty";

type StaffEnrollInput = StaffEnrollRequest;
import { changeBirthday } from "../repositories/customers";

/**
 * Staff stamping without staff accounts: the owner pairs a till phone or
 * tablet with a one-time link, which leaves a long-lived device cookie. The
 * guest shows the QR on their card; staff scan it with the normal camera and
 * land on the stamp page for that card. Security rests on the device pairing,
 * so the QR only needs to name the card.
 */

export const STAFF_COOKIE = "tt_staff";
const PAIRING_MINUTES = 15;
const DEVICE_DAYS = 365;
const UNDO_MINUTES = 10;
const MAX_STAMPS_PER_ACTION = 5;

const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

export interface StaffDevice {
  id: string;
  venueId: string;
  label: string;
}

export interface StaffDeviceRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Pairing (owner side) ────────────────────────────────────────────────────

/** A one-time link the owner opens on the device that should become a till device. */
export async function createPairing(venueId: string, label: string, userId: string | null = null): Promise<{ token: string; expiresAt: string }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000).toISOString();
  (await (await getDb()).run("INSERT INTO staff_pairings (id, venue_id, label, expires_at, user_id) VALUES (?, ?, ?, ?, ?)", digest(token), venueId, label, expiresAt, userId));
  return { token, expiresAt };
}

/** Turns a pairing link into a device cookie. Returns false for a used, expired or unknown link. */
export async function completePairing(token: string): Promise<boolean> {
  const deviceToken = newToken();
  const paired = await transaction(async (db) => {
    const pairing = (await db.get("SELECT venue_id, label, expires_at, used_at, user_id FROM staff_pairings WHERE id = ?", digest(token))) as
      | { venue_id: string; label: string; expires_at: string; used_at: string | null; user_id: string | null }
      | undefined;
    if (!pairing || pairing.used_at || Date.parse(pairing.expires_at) <= Date.now()) return false;
    (await db.run("UPDATE staff_pairings SET used_at = now() WHERE id = ?", digest(token)));
    (await db.run("INSERT INTO staff_devices (id, venue_id, label, user_id) VALUES (?, ?, ?, ?)", digest(deviceToken), pairing.venue_id, pairing.label, pairing.user_id));
    return true;
  });
  if (!paired) return false;
  (await cookies()).set(STAFF_COOKIE, deviceToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DEVICE_DAYS * 86_400_000),
  });
  return true;
}

export async function listStaffDevices(venueId: string): Promise<StaffDeviceRow[]> {
  const rows = (await (await getDb()).all("SELECT id, label, created_at, last_used_at FROM staff_devices WHERE venue_id = ? AND revoked_at IS NULL ORDER BY created_at", venueId)) as { id: string; label: string; created_at: string; last_used_at: string | null }[];
  return rows.map((row) => ({ id: row.id, label: row.label, createdAt: row.created_at, lastUsedAt: row.last_used_at }));
}

export async function revokeStaffDevice(venueId: string, deviceId: string) {
  const result = (await (await getDb()).run("UPDATE staff_devices SET revoked_at = now() WHERE id = ? AND venue_id = ? AND revoked_at IS NULL", deviceId, venueId));
  if (result.changes === 0) throw new ServiceError(404, "Device not found");
}

// ─── The device itself ───────────────────────────────────────────────────────

/** The paired device making this request, or null. */
export const currentStaffDevice = cache(async (): Promise<StaffDevice | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  // A device opened from someone's login works only while that account does: blocking or deleting it stops the till too.
  const row = (await (await getDb()).get(
      `SELECT d.id, d.venue_id, d.label
         FROM staff_devices d LEFT JOIN users u ON u.id = d.user_id
        WHERE d.id = ? AND d.revoked_at IS NULL AND (d.user_id IS NULL OR (u.id IS NOT NULL AND u.blocked_at IS NULL))`, digest(token))) as
    | { id: string; venue_id: string; label: string }
    | undefined;
  return row ? { id: row.id, venueId: row.venue_id, label: row.label } : null;
});

export async function requireStaffDevice(): Promise<StaffDevice> {
  const device = await currentStaffDevice();
  if (!device) throw new ServiceError(401, "This device isn't paired for stamping. Ask the owner to add it in the dashboard.");
  return device;
}

// ─── Stamping ────────────────────────────────────────────────────────────────

async function stampVenue(device: StaffDevice): Promise<PublicVenue> {
  // findVenue checks the subscription, so a lapsed venue can't keep stamping.
  const venue = await findVenue(device.venueId);
  if (!venue || !hasLoyaltyProgram(venue)) throw new ServiceError(400, "This venue has no active stamp card");
  return venue;
}

/** Inside a transaction the card is locked until it ends, so two tills can't spend one balance twice. */
async function requireCard(device: StaffDevice, cardId: string, lock = false): Promise<LoyaltyCardRow> {
  const db = await getDb();
  const card = lock ? await lockCard(db, cardId) : await findCardById(db, cardId);
  if (!card || card.venue_id !== device.venueId) throw new ServiceError(404, "We couldn't find that card at this venue");
  return card;
}

async function touchDevice(deviceId: string) {
  (await (await getDb()).run("UPDATE staff_devices SET last_used_at = now() WHERE id = ?", deviceId));
}

export async function viewCard(device: StaffDevice, cardId: string): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  const card = await requireCard(device, cardId);
  const customer = (await (await getDb()).get("SELECT email, first_name, name, birthday_month, birthday_day FROM customers WHERE id = ?", card.customer_id)) as {
    email: string;
    first_name: string | null;
    name: string | null;
    birthday_month: number | null;
    birthday_day: number | null;
  };
  const tiers = programTiers(venue.loyaltyProgram);
  const undoable = await lastUndoableEvent(await getDb(), card.id, UNDO_MINUTES);
  return {
    cardId: card.id,
    venueName: venue.name,
    guestName: customer.first_name || customer.name,
    guestEmail: maskEmail(customer.email),
    stamps: card.stamps,
    goal: stampGoal(tiers),
    tiers: tiers.map((tier, index) => ({ index, rewardName: tier.rewardName, stampsRequired: tier.stampsRequired, unlocked: card.stamps >= tier.stampsRequired })),
    undoable: undoable ? { kind: undoable.kind, delta: undoable.delta, rewardName: undoable.reward_name } : null,
    memberSince: new Date(parseDbDate(card.created_at) ?? Date.now()).toISOString(),
    visits: ((await (await getDb()).get("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ? AND kind = 'stamp' AND undone_at IS NULL", card.id)) as { n: number }).n,
    stampedMinutesAgo: await cooldownMinutesLeft(device.venueId, card.id),
    birthday: await birthdayTreat(venue, card, customer.birthday_month, customer.birthday_day),
    birthdayDate: customer.birthday_month && customer.birthday_day ? { month: customer.birthday_month, day: customer.birthday_day } : null,
    asksBirthday: birthdayAskOn(venue),
  };
}

/** Minutes since the last staff stamp, if inside the venue's cooldown. */
async function cooldownMinutesLeft(venueId: string, cardId: string): Promise<number | null> {
  const { cooldownMinutes } = (await getVenueSettings(venueId)).stampPolicy;
  if (cooldownMinutes === 0) return null;
  const last = await lastStaffStampAt(await getDb(), cardId);
  if (!last) return null;
  const minutesAgo = (Date.now() - (parseDbDate(last) ?? 0)) / 60_000;
  return minutesAgo < cooldownMinutes ? Math.max(0, Math.floor(minutesAgo)) : null;
}

/**
 * Adds stamps, capped at the top reward. Inside the cooldown it refuses with
 * 409 so the till can ask "add another anyway?" and retry with `force`.
 */
export async function stampCard(device: StaffDevice, cardId: string, count: number, force: boolean): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  const requested = Math.min(Math.max(1, Math.floor(count)), MAX_STAMPS_PER_ACTION);
  const { before, after } = await transaction(async (db) => {
    // Locked first, so a double tap waits here and then sees the cooldown.
    const card = await requireCard(device, cardId, true);
    if (!force) {
      const minutesAgo = await cooldownMinutesLeft(device.venueId, cardId);
      if (minutesAgo !== null) throw new ServiceError(409, `This card was stamped ${minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}. Add another anyway?`);
    }
    const next = Math.min(card.stamps + requested, goal);
    if (next === card.stamps) throw new ServiceError(400, "This card is full. Redeem the reward first.");
    await setCardStamps(db, card.id, next);
    await recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "stamp", delta: next - card.stamps, deviceId: device.id });
    return { before: card.stamps, after: next };
  });
  await touchDevice(device.id);
  await onStaffStamp({ venue, cardId, before, after });
  return await viewCard(device, cardId);
}

export async function redeemReward(device: StaffDevice, cardId: string, tierIndex: number): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  const tier = programTiers(venue.loyaltyProgram)[tierIndex];
  if (!tier) throw new ServiceError(400, "That reward doesn't exist any more. Refresh and try again.");
  await transaction(async (db) => {
    const card = await requireCard(device, cardId, true);
    if (card.stamps < tier.stampsRequired) throw new ServiceError(400, `Not enough stamps for ${tier.rewardName} yet`);
    await setCardStamps(db, card.id, card.stamps - tier.stampsRequired);
    await recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "redeem", delta: -tier.stampsRequired, rewardName: tier.rewardName, deviceId: device.id });
  });
  await touchDevice(device.id);
  return await viewCard(device, cardId);
}

/**
 * Signs a guest up at the counter, once staff have asked and the guest
 * agreed to join. An email that's already a member opens their existing
 * card instead.
 */
export async function enrollAtTill(device: StaffDevice, input: StaffEnrollInput, origin: string): Promise<StaffEnrollResponse> {
  await stampVenue(device);
  const email = normaliseEmail(input.email);
  if (!isPlausibleEmail(email)) throw new ServiceError(400, "Enter the guest's email address.");
  const name = input.name.trim();
  const joined = await enroll(
    { venueId: device.venueId, email, name, firstName: name.split(/\s+/)[0], captureSource: "till", birthday: input.birthday, agreed: true },
    origin,
  );
  await touchDevice(device.id);
  return { cardId: joined.cardId, wasExisting: joined.wasExisting };
}

/** Adds or corrects the guest's birthday, with them at the counter (only where the venue asks for birthdays). */
export async function setGuestBirthday(device: StaffDevice, cardId: string, month: number, day: number): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  if (!birthdayAskOn(venue)) throw new ServiceError(400, "This venue doesn't ask for birthdays.");
  if (!isValidBirthday(month, day)) throw new ServiceError(400, "That date doesn't exist.");
  const card = await requireCard(device, cardId);
  await changeBirthday(await getDb(), card.customer_id, month, day);
  await touchDevice(device.id);
  return await viewCard(device, cardId);
}

/** Hands over the birthday reward: once per birthday, recorded so a second visit or another till can't give it again. */
export async function giveBirthdayReward(device: StaffDevice, cardId: string): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  await transaction(async (db) => {
    // Locked, so two tills tapping at once give it only once.
    const card = await requireCard(device, cardId, true);
    const guest = (await db.get("SELECT birthday_month, birthday_day FROM customers WHERE id = ?", card.customer_id)) as { birthday_month: number | null; birthday_day: number | null };
    const treat = await birthdayTreat(venue, card, guest.birthday_month, guest.birthday_day);
    if (!treat) throw new ServiceError(400, "There's no birthday reward on this card today.");
    if (treat.given) throw new ServiceError(400, "Their birthday reward has already been given.");
    await recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "birthday", delta: 0, rewardName: treat.reward, deviceId: device.id });
  });
  await touchDevice(device.id);
  return await viewCard(device, cardId);
}

/** Reverses the last stamp, redemption or birthday reward on this card, if made in the last few minutes. */
export async function undoLast(device: StaffDevice, cardId: string): Promise<StaffCardView> {
  const venue = await stampVenue(device);
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  await transaction(async (db) => {
    const card = await requireCard(device, cardId, true);
    const event = await lastUndoableEvent(db, card.id, UNDO_MINUTES);
    if (!event) throw new ServiceError(400, `Nothing to undo. Only the last ${UNDO_MINUTES} minutes can be undone.`);
    const next = Math.min(Math.max(card.stamps - event.delta, 0), Math.max(goal, card.stamps));
    await setCardStamps(db, card.id, next);
    await markUndone(db, event.id);
    await recordStampEvent(db, { venueId: device.venueId, cardId: card.id, kind: "undo", delta: next - card.stamps, rewardName: event.reward_name, deviceId: device.id });
  });
  await touchDevice(device.id);
  return await viewCard(device, cardId);
}

export interface MemberMatch {
  cardId: string;
  name: string | null;
  email: string;
  stamps: number;
}

/** Fallback for guests without their card to hand: find them by name or email. */
export async function searchMembers(device: StaffDevice, query: string): Promise<MemberMatch[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = (await (await getDb()).all(
      `SELECT l.id, l.stamps, c.email, c.first_name, c.name
         FROM loyalty_cards l JOIN customers c ON c.id = l.customer_id
        WHERE l.venue_id = ? AND (c.email ILIKE ? OR LOWER(COALESCE(c.first_name, '') || ' ' || COALESCE(c.name, '')) LIKE ?)
        ORDER BY c.created_at DESC LIMIT 20`, device.venueId, like, like)) as { id: string; stamps: number; email: string; first_name: string | null; name: string | null }[];
  return rows.map((row) => ({ cardId: row.id, name: row.first_name || row.name, email: maskEmail(row.email), stamps: row.stamps }));
}

export interface TillActivity {
  cardId: string;
  name: string | null;
  kind: "stamp" | "redeem";
  delta: number;
  rewardName: string | null;
  undone: boolean;
  /** SQLite UTC timestamp. */
  at: string;
  deviceLabel: string | null;
}

/** The latest stamps and rewards at this venue, from any till, newest first: "did we already stamp them?" */
export async function recentTillActivity(device: StaffDevice, limit = 5): Promise<TillActivity[]> {
  const rows = (await (await getDb()).all(
      `SELECT e.card_id, e.kind, e.delta, e.reward_name, e.undone_at, e.created_at, c.first_name, c.name, d.label AS device_label
         FROM stamp_events e
         JOIN loyalty_cards l ON l.id = e.card_id
         JOIN customers c ON c.id = l.customer_id
         LEFT JOIN staff_devices d ON d.id = e.device_id
        WHERE e.venue_id = ? AND e.kind IN ('stamp', 'redeem')
        ORDER BY e.id DESC LIMIT ?`, device.venueId, limit)) as {
    card_id: string;
    kind: "stamp" | "redeem";
    delta: number;
    reward_name: string | null;
    undone_at: string | null;
    created_at: string;
    first_name: string | null;
    name: string | null;
    device_label: string | null;
  }[];
  return rows.map((row) => ({
    cardId: row.card_id,
    name: row.first_name || row.name,
    kind: row.kind,
    delta: row.delta,
    rewardName: row.reward_name,
    undone: !!row.undone_at,
    at: row.created_at,
    deviceLabel: row.device_label,
  }));
}
