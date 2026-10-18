"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import type { StaffCardView } from "@/lib/api/staff-contracts";
import { StaffCardPanel } from "./StaffCardPanel";
import { TillCardContext } from "./till-card";

/**
 * Shows a scanned card on the till at once, with no page load: one request
 * for the card, then the panel. The address still becomes the card's
 * `/staff/stamp?c=…`, so reloading shows the same card and Back returns to
 * the screen underneath, which stays mounted (and as it was) meanwhile.
 */
export function TillCardHost({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ card: StaffCardView; n: number } | null>(null);
  const pathname = usePathname();
  const cardParam = useSearchParams().get("c");

  const showCard = useCallback((card: StaffCardView) => {
    // A fresh panel each time, even for the same card scanned twice.
    setShown((previous) => ({ card, n: (previous?.n ?? 0) + 1 }));
    window.history.pushState(null, "", `/staff/stamp?c=${encodeURIComponent(card.cardId)}`);
  }, []);

  // Only while the address is this card's: Back, or any link, shows the page again.
  const active = shown && pathname === "/staff/stamp" && cardParam === shown.card.cardId ? shown : null;

  return (
    <TillCardContext.Provider value={showCard}>
      {/* "contents" keeps the page's own spacing in the till's column. */}
      <div style={{ display: active ? "none" : "contents" }}>{children}</div>
      {active && <StaffCardPanel key={active.n} initial={active.card} />}
    </TillCardContext.Provider>
  );
}
