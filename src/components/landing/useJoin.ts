"use client";

import { useCallback } from "react";
import { api } from "@/lib/api/client";
import type { EnrollResponse, FeedbackResponse } from "@/lib/api/contracts";
import type { MessageKey } from "@/lib/i18n";
import { cardCredentialsFromUrl, deviceMemory } from "@/lib/browser";
import { storedReferral } from "@/lib/referral";
import { isPlausibleEmail, normaliseEmail } from "@/lib/validation";
import { useLanding } from "./LandingContext";

type JoinResult = { ok: true; response: EnrollResponse; email: string } | { ok: false; error: MessageKey };

function currentLocale() {
  return typeof navigator !== "undefined" ? navigator.language : "en";
}

/** After any successful join: remember the device and publish the membership to every card. */
function useRecordJoin() {
  const { venue, rememberCustomer, setMembership, setLoyaltyDone } = useLanding();
  return useCallback(
    (response: EnrollResponse, email: string) => {
      if (response.customerId) {
        deviceMemory.rememberCustomer(venue.id, response.customerId);
        rememberCustomer(response.customerId);
      }
      // Next visit, the guest page shows this card instead of the join form.
      const card = cardCredentialsFromUrl(response.cardUrl);
      if (card) deviceMemory.rememberCard(venue.id, card);
      setMembership({ response, email });
      if (!response.wasExisting) setLoyaltyDone();
    },
    [venue.id, rememberCustomer, setMembership, setLoyaltyDone],
  );
}

interface StampJoinInput {
  name: string;
  email: string;
  initialStamps?: 0 | 1;
  captureSource: "landing" | "feedback";
  /** The feedback just posted, which is what earns a feedback join its stamp. */
  feedbackReceipt?: FeedbackResponse["stampReceipt"];
  /** The guest ticked "I agree to join". */
  agreed: boolean;
  birthday?: { month: number; day: number } | null;
}

/** Stamp-card enrolment, shared by the loyalty sheet and the feedback thank-you. */
export function useStampJoin() {
  const { venue } = useLanding();
  const recordJoin = useRecordJoin();
  return useCallback(
    async (input: StampJoinInput): Promise<JoinResult> => {
      const email = normaliseEmail(input.email);
      try {
        const response = await api.enroll({
          venueId: venue.id,
          email,
          name: input.name.trim() || undefined,
          firstName: input.name.trim().split(/\s+/)[0] || undefined,
          initialStamps: input.initialStamps,
          feedbackReceipt: input.feedbackReceipt ?? undefined,
          captureSource: input.captureSource,
          agreed: input.agreed ? true : undefined,
          birthday: input.birthday ?? undefined,
          locale: currentLocale(),
          ref: storedReferral(venue.id),
        });
        recordJoin(response, email);
        return { ok: true, response, email };
      } catch {
        return { ok: false, error: "something_wrong" };
      }
    },
    [venue.id, recordJoin],
  );
}

interface RewardsJoinInput {
  email: string;
  firstName: string;
  agreed: boolean;
  door: "home" | "feedback";
  birthday?: { month: number; day: number } | null;
}

/** Rewards-only membership: no stamps; the same "I agree to join" box as the stamp card. */
export function useRewardsJoin() {
  const { venue, track } = useLanding();
  const recordJoin = useRecordJoin();
  return useCallback(
    async (input: RewardsJoinInput): Promise<JoinResult> => {
      const email = normaliseEmail(input.email);
      if (!isPlausibleEmail(email)) return { ok: false, error: "rewards_email_required" };
      if (!input.agreed) return { ok: false, error: "join_agree_required" };
      track("rewards_join_tapped", { context: input.door });
      try {
        const response = await api.enroll({
          venueId: venue.id,
          email,
          firstName: input.firstName.trim() || undefined,
          captureSource: "rewards",
          door: input.door,
          agreed: true,
          birthday: input.birthday ?? undefined,
          locale: currentLocale(),
        });
        recordJoin(response, email);
        track("rewards_join_completed", { context: input.door });
        return { ok: true, response, email };
      } catch {
        track("rewards_join_failed", { context: input.door });
        return { ok: false, error: "something_wrong" };
      }
    },
    [venue.id, track, recordJoin],
  );
}
