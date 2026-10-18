import "server-only";
import type { Db } from "../db";
import { getDb } from "../db";
import { newId, newToken } from "../ids";
import { recordStampEvent } from "./stamps";
import { parseDbDate } from "@/lib/plans";

export interface LoyaltyCardRow {
  id: string;
  venue_id: string;
  customer_id: string;
  access_token: string;
  stamps: number;
  last_pass_email_at: string | null;
  last_feedback_stamp_at: string | null;
  created_at: string;
}

export async function findCardByCustomer(db: Db, customerId: string): Promise<LoyaltyCardRow | null> {
  return ((await db.get("SELECT * FROM loyalty_cards WHERE customer_id = ?", customerId)) as LoyaltyCardRow | undefined) ?? null;
}

export async function createCard(db: Db, venueId: string, customerId: string, initialStamps: number): Promise<LoyaltyCardRow> {
  const id = newId("crd");
  (await db.run("INSERT INTO loyalty_cards (id, venue_id, customer_id, access_token, stamps) VALUES (?, ?, ?, ?, ?)", id,
    venueId,
    customerId,
    newToken(),
    initialStamps,));
  if (initialStamps > 0) await recordStampEvent(db, { venueId, cardId: id, kind: "bonus", delta: initialStamps });
  return (await db.get("SELECT * FROM loyalty_cards WHERE id = ?", id)) as unknown as LoyaltyCardRow;
}

export async function findCardById(db: Db, cardId: string): Promise<LoyaltyCardRow | null> {
  return ((await db.get("SELECT * FROM loyalty_cards WHERE id = ?", cardId)) as LoyaltyCardRow | undefined) ?? null;
}

/**
 * The card, locked until the surrounding transaction ends, so two tills (or
 * a double tap) can't both stamp or redeem from the same balance.
 */
export async function lockCard(db: Db, cardId: string): Promise<LoyaltyCardRow | null> {
  return ((await db.get("SELECT * FROM loyalty_cards WHERE id = ? FOR UPDATE", cardId)) as LoyaltyCardRow | undefined) ?? null;
}

export async function setCardStamps(db: Db, cardId: string, stamps: number) {
  (await db.run("UPDATE loyalty_cards SET stamps = ? WHERE id = ?", stamps, cardId));
}

/** One stamp for feedback, never past the top reward (`goal`). Returns the card's stamps. */
export async function addFeedbackStamp(db: Db, cardId: string, goal: number): Promise<number> {
  (await db.run("UPDATE loyalty_cards SET stamps = LEAST(stamps + 1, GREATEST(stamps, ?)), last_feedback_stamp_at = now() WHERE id = ?", goal, cardId));
  const card = (await db.get("SELECT venue_id, stamps FROM loyalty_cards WHERE id = ?", cardId)) as { venue_id: string; stamps: number };
  await recordStampEvent(db, { venueId: card.venue_id, cardId, kind: "feedback", delta: 1 });
  return card.stamps;
}

export async function markPassEmailed(db: Db, cardId: string) {
  (await db.run("UPDATE loyalty_cards SET last_pass_email_at = now() WHERE id = ?", cardId));
}

/** For the public card page: the id alone is not enough, the emailed token is required. */
/** The guest who holds this card at this venue, given its private token; null otherwise. */
export async function findCardHolder(db: Db, venueId: string, cardId: string, token: string): Promise<string | null> {
  const row = (await db.get("SELECT customer_id FROM loyalty_cards WHERE id = ? AND access_token = ? AND venue_id = ?", cardId, token, venueId)) as
    | { customer_id: string }
    | undefined;
  return row?.customer_id ?? null;
}

export async function findCardForViewer(cardId: string, token: string) {
  return (
    ((await (await getDb()).get(
        `SELECT c.id, c.stamps, c.created_at, c.venue_id, cu.first_name, cu.name, cu.birthday_month, cu.birthday_day
           FROM loyalty_cards c JOIN customers cu ON cu.id = c.customer_id
          WHERE c.id = ? AND c.access_token = ?`, cardId, token)) as
      | { id: string; stamps: number; created_at: string; venue_id: string; first_name: string | null; name: string | null; birthday_month: number | null; birthday_day: number | null }
      | undefined) ?? null
  );
}

/**
 * What a member's open card checks for while they wait at the till: the
 * stamp count, and a marker that moves with every stamp, reward, birthday
 * treat or undo. One indexed lookup, so polling stays cheap.
 */
export async function findCardState(cardId: string, token: string): Promise<{ stamps: number; version: string } | null> {
  const row = (await (await getDb()).get(
    `SELECT c.stamps,
            (SELECT max(id) FROM stamp_events e WHERE e.card_id = c.id) AS last_event,
            (SELECT count(*) FROM stamp_events e WHERE e.card_id = c.id AND e.undone_at IS NOT NULL) AS undone
       FROM loyalty_cards c WHERE c.id = ? AND c.access_token = ?`, cardId, token)) as
    | { stamps: number; last_event: number | string | null; undone: number | string }
    | undefined;
  return row ? { stamps: row.stamps, version: `${row.stamps}.${row.last_event ?? 0}.${row.undone}` } : null;
}

/** SQLite now() strings are UTC without a zone marker. */
export function hoursSince(sqliteUtc: string | null): number {
  if (!sqliteUtc) return Infinity;
  return (Date.now() - (parseDbDate(sqliteUtc) ?? 0)) / 3_600_000;
}
