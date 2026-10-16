"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { FeedbackResponse } from "@/lib/api/contracts";
import type { CardCredentials } from "@/lib/browser";
import { StatusRow } from "../forms";
import { useLanding } from "../LandingContext";

/**
 * A member whose card is on this phone: their feedback stamp is claimed with
 * the card itself (no form). It's once per member, so most of the time this
 * just says thanks. The thank-you shows the Google review ask after it.
 */
export function MemberFeedbackStamp({ receipt, card }: { receipt: NonNullable<FeedbackResponse["stampReceipt"]>; card: CardCredentials }) {
  const { venue, t, track, setLoyaltyDone } = useLanding();
  const [stamped, setStamped] = useState<boolean | null>(null);
  // One claim per thank-you, even when React runs effects twice in development.
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    api
      .stampForFeedback({ venueId: venue.id, card, feedbackReceipt: receipt })
      .then((result) => {
        setStamped(result.stamped);
        if (result.stamped) {
          track("loyalty_stamp_from_feedback", { current_stamps: result.currentStamps });
          setLoyaltyDone();
        }
      })
      .catch(() => setStamped(false));
  }, [venue.id, card, receipt, track, setLoyaltyDone]);

  if (stamped === null) return <p className="sub-text">{t("loading")}</p>;
  return stamped ? (
    <StatusRow icon="stamp" title={t("stamp_added")}>
      {t("stamp_added_body")}
    </StatusRow>
  ) : (
    <StatusRow icon="info" title={t("feedback_stamp_used")}>
      {t("feedback_stamp_used_body")}
    </StatusRow>
  );
}
