import "server-only";
import { randomBytes } from "node:crypto";
import type { Db } from "../db";
import { getDb } from "../db";
import { newToken } from "../ids";

// ─── Refer-a-friend ──────────────────────────────────────────────────────────

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(length = 8): string {
  return Array.from(randomBytes(length), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** The member's invite code, created the first time they look at their card. */
export async function ensureReferralCode(cardId: string): Promise<string> {
  const db = await getDb();
  const existing = (await db.get("SELECT referral_code FROM loyalty_cards WHERE id = ?", cardId)) as { referral_code: string | null } | undefined;
  if (existing?.referral_code) return existing.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const result = (await db.run("UPDATE loyalty_cards SET referral_code = ? WHERE id = ? AND referral_code IS NULL", code, cardId));
      if (result.changes === 1) return code;
      return ((await db.get("SELECT referral_code FROM loyalty_cards WHERE id = ?", cardId)) as { referral_code: string }).referral_code;
    } catch {
      /* code already taken by another card: try another */
    }
  }
  throw new Error("Couldn't allocate a referral code");
}

export async function findReferrerCard(db: Db, venueId: string, code: string): Promise<{ id: string; customer_id: string } | null> {
  return (
    ((await db.get("SELECT id, customer_id FROM loyalty_cards WHERE venue_id = ? AND referral_code = ?", venueId, code.toLowerCase())) as
      | { id: string; customer_id: string }
      | undefined) ?? null
  );
}

export async function attachReferral(db: Db, cardId: string, referrerCardId: string) {
  (await db.run("UPDATE loyalty_cards SET referred_by_card_id = ? WHERE id = ?", referrerCardId, cardId));
}

/** Claims the one-time referral reward for this (friend's) card; false if already claimed or not referred. */
export async function claimReferralReward(db: Db, cardId: string): Promise<string | null> {
  const row = (await db.get("SELECT referred_by_card_id FROM loyalty_cards WHERE id = ? AND referred_by_card_id IS NOT NULL AND referral_rewarded_at IS NULL", cardId)) as
    | { referred_by_card_id: string }
    | undefined;
  if (!row) return null;
  (await db.run("UPDATE loyalty_cards SET referral_rewarded_at = now() WHERE id = ?", cardId));
  return row.referred_by_card_id;
}

export async function referralRewardsInLast(db: Db, referrerCardId: string, days: number): Promise<number> {
  return (
    (await db.get("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ? AND kind = 'referral' AND undone_at IS NULL AND created_at >= now() + CAST(? AS INTERVAL)", referrerCardId, `-${days} days`)) as { n: number }
  ).n;
}

/**
 * Refer-a-friend offers on one card: the welcome offer while an invited
 * friend hasn't had it, and how many friend rewards the member has earned
 * but not yet been given.
 */
export async function referralOfferState(db: Db, cardId: string): Promise<{ welcomeOpen: boolean; ready: number }> {
  const row = (await db.get(
    `SELECT (c.referred_by_card_id IS NOT NULL AND c.referral_rewarded_at IS NULL) AS welcome_open,
            (SELECT COUNT(*) FROM stamp_events e WHERE e.card_id = c.id AND e.kind = 'referral' AND e.undone_at IS NULL)
          - (SELECT COUNT(*) FROM stamp_events e WHERE e.card_id = c.id AND e.kind = 'referral_redeem' AND e.undone_at IS NULL) AS ready
       FROM loyalty_cards c WHERE c.id = ?`,
    cardId,
  )) as { welcome_open: boolean | number; ready: number } | undefined;
  return { welcomeOpen: !!row?.welcome_open, ready: Math.max(0, Number(row?.ready ?? 0)) };
}

/** Undoing a friend's welcome offer: the visit no longer counts, so the inviter's reward for it goes too. */
export async function reopenWelcome(db: Db, friendCardId: string, since: string) {
  const row = (await db.get("SELECT referred_by_card_id FROM loyalty_cards WHERE id = ?", friendCardId)) as { referred_by_card_id: string | null } | undefined;
  (await db.run("UPDATE loyalty_cards SET referral_rewarded_at = NULL WHERE id = ?", friendCardId));
  if (!row?.referred_by_card_id) return;
  (await db.run(
    `UPDATE stamp_events SET undone_at = now()
      WHERE id = (SELECT id FROM stamp_events WHERE card_id = ? AND kind = 'referral' AND undone_at IS NULL AND created_at >= ? ORDER BY id LIMIT 1)`,
    row.referred_by_card_id,
    since,
  ));
}

/** For the owner: friends who joined through an invite, and how many of those have visited. */
export async function referralStats(venueId: string): Promise<{ joined: number; visited: number }> {
  const row = (await (await getDb()).get(
      `SELECT COUNT(*) AS joined, COUNT(referral_rewarded_at) AS visited
         FROM loyalty_cards WHERE venue_id = ? AND referred_by_card_id IS NOT NULL`, venueId)) as { joined: number; visited: number };
  // Rows are copied into plain objects before they reach client components.
  return { joined: row.joined, visited: row.visited };
}

// ─── Guest emails ────────────────────────────────────────────────────────────

/** Records that an email went out; false means it was already sent for this key. */
export async function claimGuestEmail(customerId: string, kind: string, key: string): Promise<boolean> {
  return (await (await getDb()).run("INSERT INTO guest_emails (customer_id, kind, key) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", customerId, kind, key)).changes === 1;
}

export async function releaseGuestEmail(customerId: string, kind: string, key: string) {
  (await (await getDb()).run("DELETE FROM guest_emails WHERE customer_id = ? AND kind = ? AND key = ?", customerId, kind, key));
}

export async function ensureUnsubscribeToken(customerId: string): Promise<string> {
  const db = await getDb();
  const row = (await db.get("SELECT unsubscribe_token FROM customers WHERE id = ?", customerId)) as { unsubscribe_token: string | null } | undefined;
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = newToken();
  (await db.run("UPDATE customers SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL", token, customerId));
  return ((await db.get("SELECT unsubscribe_token FROM customers WHERE id = ?", customerId)) as { unsubscribe_token: string }).unsubscribe_token;
}

export async function findByUnsubscribeToken(token: string): Promise<{ customerId: string; venueId: string; unsubscribed: boolean } | null> {
  const row = (await (await getDb()).get("SELECT id, venue_id, emails_unsubscribed_at FROM customers WHERE unsubscribe_token = ?", token)) as
    | { id: string; venue_id: string; emails_unsubscribed_at: string | null }
    | undefined;
  return row ? { customerId: row.id, venueId: row.venue_id, unsubscribed: !!row.emails_unsubscribed_at } : null;
}

/** Stops the venue's birthday emails, and withdraws any agreement to offers. The card itself keeps working. */
export async function unsubscribe(customerId: string) {
  (await (await getDb()).run(
    "UPDATE customers SET emails_unsubscribed_at = COALESCE(emails_unsubscribed_at, now()), marketing_consent = 'declined', consent_updated_at = now() WHERE id = ?",
    customerId,
  ));
}

export interface EmailableGuest {
  id: string;
  email: string;
  firstName: string | null;
}

/**
 * Card members whose birthday is on this month/day, who haven't unsubscribed.
 * Only members who agreed to the membership's emails (the "I agree to join"
 * box, or staff confirming it at the till), or who once said yes to offers:
 * members from before that box existed never agreed to birthday emails.
 */
export async function birthdayGuests(venueId: string, month: number, days: number[]): Promise<EmailableGuest[]> {
  const rows = (await (await getDb()).all(
      `SELECT c.id, c.email, c.first_name FROM customers c
        WHERE c.venue_id = ? AND c.emails_unsubscribed_at IS NULL AND c.birthday_month = ?
          AND (c.membership_agreed_at IS NOT NULL OR c.marketing_consent = 'granted')
          AND c.birthday_day IN (${days.map(() => "?").join(", ")})
          AND EXISTS (SELECT 1 FROM loyalty_cards l WHERE l.customer_id = c.id)`, venueId, month, ...days)) as { id: string; email: string; first_name: string | null }[];
  return rows.map((row) => ({ id: row.id, email: row.email, firstName: row.first_name }));
}
