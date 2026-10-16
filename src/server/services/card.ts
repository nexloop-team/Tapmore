import "server-only";
import { hasLoyaltyProgram } from "@/lib/venue/features";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import type { MemberCardView } from "@/lib/api/contracts";
import { findCardForViewer } from "../repositories/loyalty-cards";
import { ensureReferralCode } from "../repositories/retention";
import { findVenue } from "../repositories/venues";
import { qrSvg } from "./qr";
import { birthdayTreat } from "./birthday";

/** The birthday reward still to be given, for the member's own card. */
async function openBirthdayReward(
  venue: Parameters<typeof birthdayTreat>[0],
  card: { id: string; birthday_month: number | null; birthday_day: number | null },
): Promise<string | null> {
  const treat = await birthdayTreat(venue, card, card.birthday_month, card.birthday_day);
  return treat && !treat.given ? treat.reward : null;
}

/**
 * Everything a member's card shows, for whoever holds the card's private
 * link (id + token): the stamp grid, rewards, the code staff scan, and the
 * invite link. Used by the card page and by the venue's guest page, which
 * shows the card inline once this device knows it.
 */
export async function memberCardView(cardId: string, token: string, origin: string): Promise<MemberCardView | null> {
  const card = token ? await findCardForViewer(cardId, token) : null;
  const venue = card ? await findVenue(card.venue_id) : null;
  if (!card || !venue) return null;
  const program = hasLoyaltyProgram(venue) ? venue.loyaltyProgram! : null;
  const tiers = programTiers(program);
  const goal = stampGoal(tiers);
  const referral = program?.referral?.enabled ? program.referral : null;
  return {
    cardId: card.id,
    venueId: venue.id,
    venueName: venue.name,
    holder: card.first_name?.trim() || card.name?.trim() || null,
    memberSince: card.created_at,
    stamps: card.stamps,
    goal,
    tiers: tiers.map((tier) => ({ rewardName: tier.rewardName, stampsRequired: tier.stampsRequired, unlocked: card.stamps >= tier.stampsRequired })),
    staffQrSvg: program ? await qrSvg(`${origin}/staff/stamp?c=${card.id}`) : null,
    invite: referral
      ? {
          url: `${origin}/s?i=${encodeURIComponent(venue.shortCode)}&ref=${await ensureReferralCode(card.id)}&s=invite`,
          referrerStamps: referral.referrerStamps,
          friendStamps: referral.friendStamps,
        }
      : null,
    birthdayTreat: await openBirthdayReward(venue, card),
  };
}
