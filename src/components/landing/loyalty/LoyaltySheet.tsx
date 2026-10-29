"use client";

import { useState } from "react";
import { enrolEmailCopy } from "@/lib/landing-copy";
import { isPlausibleEmail } from "@/lib/validation";
import { birthdayAskOn } from "@/lib/venue/features";
import type { LoyaltyProgram } from "@/lib/venue/types";
import { useSheet } from "../FeatureCard";
import { BirthdayFields, EMPTY_BIRTHDAY, JoinAgreement, Field, SuccessPanel, JoinedCard, birthdayAnswer } from "../forms";
import { useLanding } from "../LandingContext";
import { useStampJoin } from "../useJoin";

/** "Free hot drink" → "hot drink", so the sentence reads "your hot drink is on us". */
function rewardNoun(value: string) {
  const noun = value.replace(/^free\s+/i, "");
  return noun.charAt(0).toLowerCase() + noun.slice(1);
}

/** "10% off" stays, "Free haircut" reads "free haircut" mid-sentence. */
function lowerFirst(value: string) {
  return /^[A-Z][a-z]/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

/** One line on how the card works (or the refer-a-friend offers), then the reward ladder when there's more than one reward. */
function RewardsSummary({ program }: { program: LoyaltyProgram }) {
  const { tf } = useLanding();
  if (program.referralOffers) return <p className="sheet-intro">{tf("loyalty_referral_intro", { friend: lowerFirst(program.referralOffers.friend), member: lowerFirst(program.referralOffers.member) })}</p>;
  const tiers = program.rewardTiers ?? [];
  const top = tiers.length > 0 ? tiers[tiers.length - 1] : { stampsRequired: program.stampsRequired, rewardName: program.rewardName };
  return (
    <>
      <p className="sheet-intro">
        {/^free\s/i.test(top.rewardName)
          ? tf("loyalty_join_intro", { stamps: top.stampsRequired, reward: rewardNoun(top.rewardName) })
          : tf("loyalty_join_intro_plain", { stamps: top.stampsRequired, reward: rewardNoun(top.rewardName) })}
      </p>
      {program.stampRule && <p className="sheet-intro sheet-rule">{program.stampRule}</p>}
      {tiers.length > 1 && (
        <ul className="tier-ladder">
          {tiers.map((tier, i) => (
            <li key={`${tier.rewardName}-${i}`}>
              <span className="tier-dot">{tier.stampsRequired}</span>
              <span className="tier-name">{tier.rewardName}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The stamp-card join on the home card. */
export function LoyaltySheet() {
  const { venue, t, tf, track, membership } = useLanding();
  const { close } = useSheet();
  const join = useStampJoin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const program = venue.loyaltyProgram!;
  // Optional, for the birthday reward.
  const showBirthday = birthdayAskOn(venue);
  const valid = name.trim().length > 0 && isPlausibleEmail(email) && agreed;

  if (membership) {
    const { response, email: joinedEmail } = membership;
    return (
      <div className="sheet-inner">
        <SuccessPanel icon="check" title={t(response.wasExisting ? "already_enrolled" : "youre_enrolled")} onClose={close}>
          <p>{enrolEmailCopy(response, joinedEmail, t, tf)}</p>
          <JoinedCard response={response} />
        </SuccessPanel>
      </div>
    );
  }

  async function submit() {
    if (!valid) {
      setError(t("please_enter_details"));
      return;
    }
    track("loyalty_signup_started");
    setBusy(true);
    setError(null);
    const result = await join({
      name,
      email,
      captureSource: "landing",
      agreed,
      birthday: showBirthday ? birthdayAnswer(birthday) : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(t(result.error));
      return;
    }
    track(result.response.wasExisting ? "loyalty_signup_already_enrolled" : "loyalty_signup_completed");
  }

  return (
    <div className="sheet-inner">
      <RewardsSummary program={program} />
      <form
        className="form-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t("your_name")}>
          <input className="text-input" type="text" autoComplete="name" enterKeyHint="next" autoCorrect="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("email_address")}>
          <input className="text-input" type="email" autoComplete="email" enterKeyHint="done" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {showBirthday && (
          <div className="birthday-block">
            <p className="g-field-label">{t("birthday_optional")}</p>
            <BirthdayFields value={birthday} onChange={setBirthday} />
          </div>
        )}
        <JoinAgreement checked={agreed} onChange={setAgreed} />
        <button type="submit" className={`primary-btn${busy ? " busy" : ""}`} disabled={!valid || busy}>
          {busy ? t("enrolling") : t("join_loyalty")}
        </button>
        <p className="sheet-footnote">{t("loyalty_member_hint")}</p>
      </form>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
