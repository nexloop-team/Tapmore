"use client";

import type { VenueSettings } from "@/lib/venue/settings";
import { Card, Field, SwitchRow } from "./ui";

type Birthday = VenueSettings["automations"]["birthday"];

/** A birthday reward that's on needs a reward written: the Rewards page won't save without one. */
export function birthdayRewardMissing(birthday: Birthday, collectsBirthdays: boolean): boolean {
  return collectsBirthdays && birthday.enabled && !birthday.offer.trim();
}

/**
 * What members get on their birthday, whatever the owner likes. It needs the
 * birthdays asked under the customers' details tab (asking for birthdays doesn't need a
 * reward). On the day, the member's card shows it and the till tells staff,
 * and members get a short birthday email inviting them in. Saved with the
 * rest of the Rewards page, from its save bar.
 */
export function BirthdayRewardForm({
  value,
  onChange,
  collectsBirthdays,
  stampCard,
  onAskBirthdays,
  detailsTab,
}: {
  value: Birthday;
  onChange: (next: Birthday) => void;
  collectsBirthdays: boolean;
  /** A stamp card has a till to give and record it; a members club shows it on the card only. */
  stampCard: boolean;
  onAskBirthdays: () => void;
  /** The tab's name in the business's words: "Guests' details", "Customers' details". */
  detailsTab: string;
}) {
  // Without birthdays there's no reward, whatever was saved before.
  const on = collectsBirthdays && value.enabled;
  const missingReward = birthdayRewardMissing(value, collectsBirthdays);
  const reward = value.offer.trim().replace(/[.!]+$/, "") || "your reward";

  return (
    <Card title="Birthday reward" description="A treat for each member on their birthday, given at your counter.">
      <SwitchRow
        title="Give a birthday reward"
        description={collectsBirthdays ? undefined : `Turn on “Ask for birthdays” under ${detailsTab} first: without a birthday there's nothing to celebrate.`}
        checked={on}
        disabled={!collectsBirthdays}
        onChange={(enabled) => onChange({ ...value, enabled })}
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
            hint="Anything you like: a free dessert, 20% off the bill, a free haircut."
            error={missingReward ? "Write what members get on their birthday." : null}
          >
            <input
              id="birthday-reward"
              className="input"
              maxLength={200}
              placeholder="e.g. 20% off your bill"
              value={value.offer}
              onChange={(event) => onChange({ ...value, offer: event.target.value })}
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
    </Card>
  );
}
