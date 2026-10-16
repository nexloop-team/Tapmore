import "server-only";
import { isBirthdayToday } from "@/lib/venue/birthday";
import { birthdayAskOn } from "@/lib/venue/features";
import { venueTimeZone } from "@/lib/venue/region";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb } from "../db";
import { localParts } from "../jobs/time";
import { getVenueSettings } from "../repositories/venues";

export interface BirthdayTreat {
  /** What the owner gives, in their words. */
  reward: string;
  /** Staff already gave it for this birthday at the till. */
  given: boolean;
}

/** Given at the till within the last 300 days, i.e. for this birthday (undone ones don't count). */
async function givenThisBirthday(cardId: string): Promise<boolean> {
  return !!(await (await getDb()).get(
    "SELECT 1 FROM stamp_events WHERE card_id = ? AND kind = 'birthday' AND undone_at IS NULL AND created_at > now() - INTERVAL '300 days'",
    cardId,
  ));
}

/**
 * The owner's birthday reward, on the member's birthday (the venue's date),
 * for their card and the till: given at the counter, so it needs no email
 * and no consent. Staff check the date (e.g. ID) when the guest collects it.
 * Null on other days, without a birthday, or when the owner has no reward or
 * doesn't ask for birthdays (the reward needs birthdays; asking doesn't need a reward).
 */
export async function birthdayTreat(
  venue: PublicVenue,
  card: { id: string },
  month: number | null,
  day: number | null,
  now = new Date(),
): Promise<BirthdayTreat | null> {
  if (!month || !day || !birthdayAskOn(venue)) return null;
  const { birthday } = (await getVenueSettings(venue.id)).automations;
  const reward = birthday.offer.trim();
  if (!birthday.enabled || !reward) return null;
  if (!isBirthdayToday(month, day, localParts(now, venueTimeZone(venue.currencyCode)))) return null;
  return { reward, given: await givenThisBirthday(card.id) };
}
