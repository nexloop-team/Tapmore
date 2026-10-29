import type { LoyaltyProgram, RewardTier } from "./types";

/** Starting offers for "Refer a friend" without stamps; the owner rewrites them. */
export const DEFAULT_REFERRAL_OFFERS = { friend: "10% off", member: "10% off" };

/**
 * The reward ladder of a stamp card, cheapest first. A programme without
 * tiers is a ladder of one: its main reward.
 */
export function programTiers(program: LoyaltyProgram | null | undefined): RewardTier[] {
  if (!program || program.stampsEnabled === false) return [];
  const tiers = program.rewardTiers?.length ? program.rewardTiers : [{ rewardName: program.rewardName, stampsRequired: program.stampsRequired }];
  return [...tiers].filter((tier) => tier.stampsRequired > 0 && tier.rewardName).sort((a, b) => a.stampsRequired - b.stampsRequired);
}

/** Stamps needed for the top reward; a card never holds more than this. */
export function stampGoal(tiers: RewardTier[]): number {
  return tiers.length ? tiers[tiers.length - 1].stampsRequired : 0;
}
