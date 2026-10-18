"use client";

import type { MemberCardView } from "@/lib/api/contracts";

/**
 * The last full view of each member card this page fetched, so the grid's
 * card tile and the card sheet share one request: the sheet opens with the
 * card already there. Changes made at the till arrive through the cheap
 * state check (useCardChanges), which fetches the card again.
 */
const views = new Map<string, { view: MemberCardView; at: number }>();

export function rememberCardView(view: MemberCardView) {
  views.set(view.cardId, { view, at: Date.now() });
}

/** The card as last fetched, if that was within `maxAgeMs`. */
export function recentCardView(cardId: string, maxAgeMs = 60_000): MemberCardView | null {
  const entry = views.get(cardId);
  return entry && Date.now() - entry.at < maxAgeMs ? entry.view : null;
}
