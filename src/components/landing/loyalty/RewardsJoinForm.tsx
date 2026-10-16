"use client";

import { useState } from "react";
import { rewardsPassLine } from "@/lib/landing-copy";
import { birthdayAskOn } from "@/lib/venue/features";
import { BirthdayFields, EMPTY_BIRTHDAY, Field, JoinAgreement, SuccessPanel, JoinedCard, birthdayAnswer } from "../forms";
import { useLanding, type Membership } from "../LandingContext";
import { useRewardsJoin } from "../useJoin";

export function RewardsJoinedPanel({ membership }: { membership: Membership }) {
  const { t, tf } = useLanding();
  const line = rewardsPassLine(membership.response, membership.email, true, tf);
  return (
    <SuccessPanel icon="heart" title={t("rewards_joined")}>
      {line && <p>{line}</p>}
      <JoinedCard response={membership.response} />
    </SuccessPanel>
  );
}

/**
 * The rewards-only join, used on the home card and on the feedback thank-you.
 * Validation happens on tap: the button is never disabled up front.
 */
export function RewardsJoinForm({ door, withBirthday }: { door: "home" | "feedback"; withBirthday: boolean }) {
  const { venue, t } = useLanding();
  const join = useRewardsJoin();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showBirthday = withBirthday && birthdayAskOn(venue);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await join({ email, firstName, agreed, door, birthday: showBirthday ? birthdayAnswer(birthday) : null });
    setBusy(false);
    if (!result.ok) setError(t(result.error));
  }

  return (
    <>
      <form
        className="form-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t("first_name")}>
          <input className="text-input" type="text" autoComplete="given-name" autoCorrect="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label={t("email_address")}>
          <input className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {showBirthday && (
          <div className="birthday-block">
            <p className="g-field-label">{t("birthday_optional")}</p>
            <BirthdayFields value={birthday} onChange={setBirthday} />
          </div>
        )}
        <JoinAgreement checked={agreed} onChange={setAgreed} />
        <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={busy}>
          {busy ? t("enrolling") : t("feature_loyalty")}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </>
  );
}

/** Home-card sheet for a rewards-only venue. */
export function RewardsSheet() {
  const { t, membership } = useLanding();
  return (
    <div className="sheet-inner">
      {membership ? (
        <RewardsJoinedPanel membership={membership} />
      ) : (
        <>
          <p className="sheet-intro">{t("rewards_sub")}</p>
          <RewardsJoinForm door="home" withBirthday />
        </>
      )}
    </div>
  );
}
