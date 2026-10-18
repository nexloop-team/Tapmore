import "server-only";
import type { Db } from "../db";
import { getDb } from "../db";

/**
 * The stamp ledger: every change to a card's stamp count, who made it and
 * when. Undo marks the original event and records a compensating one, so the
 * history always adds up to the card's balance.
 */

export type StampEventKind = "stamp" | "redeem" | "undo" | "feedback" | "bonus" | "referral" | "birthday";

export interface StampEvent {
  id: number;
  venue_id: string;
  card_id: string;
  kind: StampEventKind;
  delta: number;
  reward_name: string | null;
  device_id: string | null;
  undone_at: string | null;
  created_at: string;
}

export async function recordStampEvent(
  db: Db,
  input: { venueId: string; cardId: string; kind: StampEventKind; delta: number; rewardName?: string | null; deviceId?: string | null; requestId?: string | null },
): Promise<number> {
  const row = await db.get<{ id: number }>(
    "INSERT INTO stamp_events (venue_id, card_id, kind, delta, reward_name, device_id, request_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    input.venueId,
    input.cardId,
    input.kind,
    input.delta,
    input.rewardName ?? null,
    input.deviceId ?? null,
    input.requestId ?? null,
  );
  return Number(row!.id);
}

/** This till already made the change `requestId` names: a resend, to be answered, not applied again. */
export async function requestAlreadyDone(db: Db, deviceId: string, requestId: string | undefined): Promise<boolean> {
  if (!requestId) return false;
  return !!(await db.get("SELECT 1 FROM stamp_events WHERE device_id = ? AND request_id = ?", deviceId, requestId));
}

/** The most recent staff action on a card that can still be undone. */
export async function lastUndoableEvent(db: Db, cardId: string, withinMinutes: number): Promise<StampEvent | null> {
  return (
    ((await db.get(
        `SELECT * FROM stamp_events
          WHERE card_id = ? AND kind IN ('stamp', 'redeem', 'birthday') AND undone_at IS NULL
            AND created_at >= now() + CAST(? AS INTERVAL)
          ORDER BY id DESC LIMIT 1`, cardId, `-${withinMinutes} minutes`)) as StampEvent | undefined) ?? null
  );
}

/** When staff last stamped this card (ignoring undone stamps), for the cooldown. */
export async function lastStaffStampAt(db: Db, cardId: string): Promise<string | null> {
  const row = (await db.get("SELECT created_at FROM stamp_events WHERE card_id = ? AND kind = 'stamp' AND undone_at IS NULL ORDER BY id DESC LIMIT 1", cardId)) as { created_at: string } | undefined;
  return row?.created_at ?? null;
}

export async function markUndone(db: Db, eventId: number) {
  (await db.run("UPDATE stamp_events SET undone_at = now() WHERE id = ?", eventId));
}

export async function recentEvents(cardId: string, limit = 5): Promise<StampEvent[]> {
  return (await (await getDb()).all("SELECT * FROM stamp_events WHERE card_id = ? ORDER BY id DESC LIMIT ?", cardId, limit)) as unknown as StampEvent[];
}
