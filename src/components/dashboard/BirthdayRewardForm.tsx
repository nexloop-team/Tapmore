"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { VenueSettings } from "@/lib/venue/settings";
import { Card, Field, SwitchRow } from "./ui";

/**
 * What members get on their birthday, whatever the owner likes. It needs the
 * birthdays asked under Guest info (asking for birthdays doesn't need a
 * reward). On the day, the member's card shows it and the till tells staff,
 * and members get a short birthday email inviting them in.
 */
export function BirthdayRewardForm({
  venueId,
  initial,
  collectsBirthdays,
  stampCard,
  onAskBirthdays,
}: {
  venueId: string;
  initial: VenueSettings["automations"]["birthday"];
  collectsBirthdays: boolean;
  /** A stamp card has a till to give and record it; a members club shows it on the card only. */
  stampCard: boolean;
  onAskBirthdays: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Without birthdays there's no reward, whatever was saved before.
  const on = collectsBirthdays && draft.enabled;
  const dirty = saved.enabled !== draft.enabled || saved.offer !== draft.offer;
  const missingReward = on && !draft.offer.trim();
  const reward = draft.offer.trim().replace(/[.!]+$/, "") || "your reward";

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await dashboardApi.updateSettings(venueId, { automations: { birthday: draft } });
      setSaved(result.automations.birthday);
      setDraft(result.automations.birthday);
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Birthday reward" description="A treat for each member on their birthday, given at your counter.">
      <SwitchRow
        title="Give a birthday reward"
        description={collectsBirthdays ? undefined : "Turn on “Ask for birthdays” under Guest info first: without a birthday there's nothing to celebrate."}
        checked={on}
        disabled={!collectsBirthdays}
        onChange={(value) => setDraft({ ...draft, enabled: value })}
      />
      {!collectsBirthdays && (
        <button type="button" className="btn btn-sm" style={{ justifySelf: "start" }} onClick={onAskBirthdays}>
          Ask for birthdays
        </button>
      )}
      {on && (
        <>
          <Field
            label="What they get"
            htmlFor="birthday-reward"
            hint="Anything you like: a free dessert, 20% off the bill, a free drink."
            error={missingReward ? "Write what members get on their birthday." : null}
          >
            <input
              id="birthday-reward"
              className="input"
              maxLength={200}
              placeholder="A free dessert"
              value={draft.offer}
              onChange={(event) => setDraft({ ...draft, offer: event.target.value })}
            />
          </Field>
          <div className="reward-where">
            <h3>Who gets it</h3>
            <p>Every member who gave their birthday, once per birthday. Staff can check their ID when they collect it.</p>
            <h3>Where members see it</h3>
            <ul>
              <li>
                <strong>On their card</strong>, on your page, on their birthday only: “Happy birthday! {reward}. Show your card to staff.”
              </li>
              {stampCard ? (
                <li>
                  <strong>At your till</strong>, when staff scan their card that day: “Birthday today”. Staff tap <em>Give birthday reward</em>, so it&apos;s given once.
                </li>
              ) : (
                <li>
                  <strong>To your staff</strong>, on the member&apos;s phone: they show their card at the counter.
                </li>
              )}
              <li>
                <strong>By email</strong>, on their birthday: a short “Happy birthday” inviting them in for their reward, without saying what it is. It&apos;s part of their membership; they can unsubscribe from it.
              </li>
            </ul>
          </div>
        </>
      )}
      <div className="inline" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy || missingReward}>
          {busy && <Loader2 className="spin" aria-hidden />} Save birthday reward
        </button>
        {message && <span className={message.ok ? "hint" : "field-error"}>{message.text}</span>}
      </div>
    </Card>
  );
}
