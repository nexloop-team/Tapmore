"use client";

import type { FeedbackResponse } from "@/lib/api/contracts";
import { useEffect, useState } from "react";
import { hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import { useSheet } from "../FeatureCard";
import { StatusRow, SuccessPanel } from "../forms";
import { useLanding } from "../LandingContext";
import { RewardsJoinForm } from "../loyalty/RewardsJoinForm";
import { rewardsPassLine } from "@/lib/landing-copy";
import { SocialLinks, hasSocialLinks } from "../SocialLinks";
import { useGoogleReview } from "../useGoogleReview";
import { FreeStampJoin } from "./FreeStampJoin";
import { MemberFeedbackStamp } from "./MemberFeedbackStamp";
import { deviceMemory, parseCardCredentials } from "@/lib/browser";

/** Positive enough for the "so glad you enjoyed it" wording on the socials branch. */
const POSITIVE_THRESHOLD = 0.5;

function GoogleReviewButton({ feedbackText, context }: { feedbackText: string; context: string }) {
  const { t } = useLanding();
  const review = useGoogleReview();
  return (
    <button type="button" className="google-btn" onClick={() => review.open(context, feedbackText)}>
      {t("leave_google_review")}
    </button>
  );
}

/** The review ask beneath a loyalty result: the same layout as the plain Google thank-you (text, button, socials). */
function ReviewNudge({ feedbackText, context }: { feedbackText: string; context: string }) {
  const { t } = useLanding();
  return (
    <>
      <p style={{ marginTop: 16 }}>{t("tap_to_review")}</p>
      <GoogleReviewButton feedbackText={feedbackText} context={context} />
      <SocialLinks context="thankyou" />
    </>
  );
}

/**
 * After feedback, the next ask. The first matching branch wins:
 *  1. stamp card not yet joined → free-stamp join (+ review nudge)
 *  2. rewards-only, not joined  → rewards join (+ review nudge)
 *  3. Google link               → Google review as the main ask, socials below
 *  4. positive, socials only    → social links
 *  otherwise just the thank-you.
 *
 * Every guest who leaves feedback is offered the Google review, whatever
 * they wrote: Google's policy forbids selectively asking happy customers
 * ("review gating"), and venues caught doing it can lose their reviews.
 * Sentiment only reaches the owner's dashboard.
 */
export function FeedbackThankYou({ text, score, receipt }: { text: string; score: number; receipt: FeedbackResponse["stampReceipt"] }) {
  const { venue, t, tf, track, loyaltyDone, membership } = useLanding();
  const { close } = useSheet();
  const review = useGoogleReview();

  const positive = score > POSITIVE_THRESHOLD;
  const showGoogle = !!review.url;
  // Decided once, when the thank-you appears: joining below must not swap the branch out from under the guest.
  // A member whose card is on this phone isn't asked to join: their stamp is claimed with the card.
  const [memberCard] = useState(() => parseCardCredentials(deviceMemory.cardRaw(venue.id)));
  const [branch] = useState(() => {
    // The free stamp only when this feedback earned one (the owner can switch it off).
    // A card on this phone claims it straight away, even if they joined a minute ago:
    // a member's first feedback earns one (the server allows one per member, ever).
    if (hasLoyaltyProgram(venue) && receipt && memberCard) return "member";
    if (hasLoyaltyProgram(venue) && receipt && !loyaltyDone) return "loyalty";
    if (isRewardsOnly(venue) && venue.crm.feedbackCapture && !membership) return "rewards";
    if (showGoogle) return "google";
    if (positive && hasSocialLinks(venue.socialLinks)) return "social";
    return "none";
  });

  useEffect(() => {
    if (showGoogle) track("google_review_prompted", { from_context: "thankyou" });
    if (branch === "rewards") track("rewards_join_shown", { context: "feedback" });
    // Reported once, when the thank-you appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="feedback-thanks">
      <SuccessPanel icon="check" title={t("thank_you")} onClose={close}>
        <p>{t("feedback_sent")}</p>

        {branch === "member" && memberCard && (
          <>
            <div className="thanks-next">
              <MemberFeedbackStamp receipt={receipt!} card={memberCard} />
            </div>
            {showGoogle && <ReviewNudge feedbackText={text} context="loyalty" />}
          </>
        )}

        {/* A join form is the one next step; the Google review ask follows once they've joined. */}
        {branch === "loyalty" && (
          <div className="thanks-next">
            <FreeStampJoin receipt={receipt!} after={showGoogle ? <ReviewNudge feedbackText={text} context="loyalty" /> : null} />
          </div>
        )}

        {branch === "rewards" && (
          <>
            <div className="review-prompt">
              {membership ? (
                <StatusRow icon="heart" title={t("youre_enrolled")}>
                  {rewardsPassLine(membership.response, membership.email, false, tf)}
                </StatusRow>
              ) : (
                <>
                  <p>{tf("rewards_thankyou_prompt", { business: venue.name })}</p>
                  <RewardsJoinForm door="feedback" withBirthday />
                </>
              )}
            </div>
            {/* Joined: now the Google review ask. */}
            {membership && showGoogle && <ReviewNudge feedbackText={text} context="thankyou" />}
          </>
        )}

        {branch === "google" && (
          <>
            <p style={{ marginTop: 8 }}>{t("tap_to_review")}</p>
            <GoogleReviewButton feedbackText={text} context="thankyou" />
            <SocialLinks context="thankyou" />
          </>
        )}

        {branch === "social" && (
          <>
            <p style={{ marginTop: 8 }}>{t("glad_enjoyed")}</p>
            <SocialLinks context="thankyou" />
          </>
        )}
      </SuccessPanel>
    </div>
  );
}
