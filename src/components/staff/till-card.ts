"use client";

import { createContext, useContext } from "react";
import type { StaffCardView } from "@/lib/api/staff-contracts";

/** Shows a card on the till without loading a new page (see TillCardHost). */
export const TillCardContext = createContext<((card: StaffCardView) => void) | null>(null);

/** Null outside the till layout: callers then navigate to the stamp page instead. */
export function useShowCard() {
  return useContext(TillCardContext);
}
