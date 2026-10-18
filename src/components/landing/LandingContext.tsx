"use client";

import { createContext, useContext } from "react";
import type { Track } from "@/lib/analytics";
import type { EnrollResponse } from "@/lib/api/contracts";
import type { Locale, Translate, TranslateFormat } from "@/lib/i18n";
import type { Theme } from "@/lib/theme";
import type { PublicVenue } from "@/lib/venue/types";

/** A successful join (stamp card or rewards-only) and the address it was made with. */
export interface Membership {
  response: EnrollResponse;
  email: string;
}

export interface DialogContent {
  title?: string;
  message: string;
}

/**
 * Everything the cards share. Joins made on one surface (the feedback
 * thank-you, the Wi-Fi gate) are visible to the others through here, so the
 * page never asks a guest to do something they have already done.
 */
export interface LandingSession {
  venue: PublicVenue;
  locale: Locale;
  t: Translate;
  tf: TranslateFormat;
  track: Track;
  /** The `s` query param: which QR code / table was scanned. */
  source: string;
  theme: Theme;
  feedbackVariant: "box" | "anon";

  /** Opaque id of a guest this device has joined or been captured as. */
  knownCustomerId: string | null;
  rememberCustomer: (customerId: string) => void;
  /** Latest join from any surface; drives the loyalty card's success view. */
  membership: Membership | null;
  setMembership: (membership: Membership) => void;
  /** A new join or a feedback stamp happened this visit: stop offering the free stamp. */
  loyaltyDone: boolean;
  setLoyaltyDone: () => void;

  showDialog: (content: DialogContent) => void;
}

/** The feedback box, focused when its card opens (see LandingApp). */
export const FEEDBACK_TEXTAREA_ID = "feedback-text";

export const LandingContext = createContext<LandingSession | null>(null);

export function useLanding(): LandingSession {
  const session = useContext(LandingContext);
  if (!session) throw new Error("useLanding must be used inside <LandingProvider>");
  return session;
}
