"use client";

import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { FeedbackResponse } from "@/lib/api/contracts";
import { enrolEmailCopy } from "@/lib/landing-copy";
import { isPlausibleEmail, maskEmail, normaliseEmail } from "@/lib/validation";
import { birthdayAskOn } from "@/lib/venue/features";
import { BirthdayFields, EMPTY_BIRTHDAY, Field, JoinAgreement, StatusRow, birthdayAnswer } from "../forms";
import { useLanding } from "../LandingContext";
import { useStampJoin } from "../useJoin";

type Outcome = { kind: "enrolled"; node: string } | { kind: "stamped" } | { kind: "not_stamped" };

/**
 * The thank-you's loyalty ask: "you've earned a free stamp, join to claim it".
 * A new member is enrolled with the stamp; an existing member is stamped
 * instead (the join endpoint never adds stamps to an existing card).
 */
export function FreeStampJoin({ receipt, after }: { receipt: NonNullable<FeedbackResponse["stampReceipt"]>; after?: ReactNode }) {
  const { venue, t, tf, track, setLoyaltyDone } = useLanding();
  const join = useStampJoin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const valid = name.trim().length > 0 && isPlausibleEmail(email) && agreed;

  async function submit() {
    if (!valid) {
      setError(t("please_enter_details"));
      return;
    }
    track("loyalty_signup_started", { from_context: "feedback_thankyou" });
    setBusy(true);
    setError(null);
    const result = await join({
      name,
      email,
      initialStamps: 1,
      captureSource: "feedback",
      feedbackReceipt: receipt,
      agreed,
      birthday: birthdayAskOn(venue) ? birthdayAnswer(birthday) : null,
    });
    if (!result.ok) {
      setBusy(false);
      setError(t(result.error));
      return;
    }
    const { response } = result;
    if (!response.wasExisting) {
      track("loyalty_signup_completed", { from_context: "feedback_thankyou" });
      setOutcome({
        kind: "enrolled",
        node: response.passEmailed ? tf("pass_on_its_way", { email: maskEmail(result.email) }) : enrolEmailCopy(response, result.email, t, tf),
      });
      return;
    }
    track("loyalty_signup_already_enrolled", { from_context: "feedback_thankyou" });
    try {
      const stamp = await api.stampForFeedback({ venueId: venue.id, email: normaliseEmail(email), feedbackReceipt: receipt });
      if (stamp.stamped) {
        track("loyalty_stamp_from_feedback", { current_stamps: stamp.currentStamps });
        setLoyaltyDone();
      }
      // Already a member: their card is on its way by email (and on the venue's page on this phone).
      setOutcome({ kind: stamp.stamped ? "stamped" : "not_stamped" });
    } catch {
      setBusy(false);
      setError(t("something_wrong"));
    }
  }

  if (outcome) {
    return (
      <>
        {outcome.kind === "enrolled" && (
          <StatusRow icon="heart" title={t("youre_enrolled")}>
            {outcome.node}
          </StatusRow>
        )}
        {outcome.kind === "stamped" && (
          <StatusRow icon="stamp" title={t("stamp_added")}>
            {t("stamp_added_body")}
          </StatusRow>
        )}
        {outcome.kind === "not_stamped" && (
          <StatusRow icon="info" title={t("feedback_stamp_used")}>
            {t("feedback_stamp_used_body")}
          </StatusRow>
        )}
        {/* Joined: now the Google review ask, rather than the card (it's on the venue's page already). */}
        {after}
      </>
    );
  }

  return (
    <div className="thanks-join">
      <p>{tf("earn_rewards_visit", { business: venue.name })}</p>
      <form
        className="form-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t("your_name")}>
          <input className="text-input" type="text" autoComplete="name" autoCorrect="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("email_address")}>
          <input className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {birthdayAskOn(venue) && (
          <div className="birthday-block">
            <p className="g-field-label">{t("birthday_optional")}</p>
            <BirthdayFields value={birthday} onChange={setBirthday} />
          </div>
        )}
        <JoinAgreement checked={agreed} onChange={setAgreed} />
        <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={!valid || busy}>
          {busy ? t("enrolling") : t("join_free_stamp")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
