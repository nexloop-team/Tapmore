"use client";

import { AlertTriangle, Cake, Check, ChevronLeft, Gift, Loader2, Minus, Plus, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { StaffCardView } from "@/lib/api/staff-contracts";
import { initials } from "@/lib/format";
import { daysInMonth } from "@/lib/validation";
import { ScanCardButton } from "./ScanCardButton";

/** Dots drawn per row on the card; longer cards wrap. */
const DOTS_PER_ROW = 10;

/** The till screen for one card: add stamps, hand out a reward, or undo a slip. */
export function StaffCardPanel({ initial }: { initial: StaffCardView }) {
  const [card, setCard] = useState(initial);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmAnother, setConfirmAnother] = useState<string | null>(null);
  /** Stamps just added: shows the "Stamp added" screen until staff move on. */
  const [stamped, setStamped] = useState<number | null>(null);
  /** The birthday being added or corrected, while the editor is open. */
  const [birthdayEdit, setBirthdayEdit] = useState<{ month: number; day: number } | null>(null);

  async function act(run: () => Promise<StaffCardView>, done: (next: StaffCardView) => void) {
    setBusy(true);
    setMessage(null);
    setConfirmAnother(null);
    try {
      const next = await run();
      setCard(next);
      setCount(1);
      done(next);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) setConfirmAnother(error.message);
      else setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const stamp = (force = false) => act(() => dashboardApi.staffStamp({ cardId: card.cardId, count, force }), (next) => setStamped(next.stamps - card.stamps));
  const undo = () =>
    act(
      () => dashboardApi.staffUndo({ cardId: card.cardId }),
      () => {
        setStamped(null);
        setMessage({ tone: "ok", text: "Undone." });
      },
    );

  const name = card.guestName || "Guest";
  const unlocked = card.tiers.filter((tier) => tier.unlocked);
  const nextTier = card.tiers.find((tier) => !tier.unlocked);
  const room = Math.max(0, card.goal - card.stamps);

  if (stamped !== null) {
    return (
      <div className="till-done">
        <div className="till-done-body" role="status">
          <span className="till-done-tick" aria-hidden>
            <Check />
          </span>
          <h1>{stamped === 1 ? "Stamp added" : `${stamped} stamps added`}</h1>
          <p>
            {name} now has {card.stamps} of {card.goal}
            {nextTier ? ` · ${nextTier.stampsRequired - card.stamps} to a ${nextTier.rewardName.toLowerCase()}` : unlocked.length > 0 ? " · reward ready" : ""}
          </p>
          {card.undoable && (
            <button type="button" className="staff-btn staff-btn-ghost" disabled={busy} onClick={undo}>
              {busy ? <Loader2 className="spin" aria-hidden /> : <Undo2 aria-hidden />} Undo
            </button>
          )}
          <button type="button" className="till-link" onClick={() => setStamped(null)}>
            Back to {name}&apos;s card
          </button>
        </div>
        <ScanCardButton label="Scan the next card" />
      </div>
    );
  }

  const since = new Date(card.memberSince).toLocaleDateString("en-IN", { month: "long" });
  const birthdayText = card.birthdayDate ? new Date(2000, card.birthdayDate.month - 1, card.birthdayDate.day).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : null;
  const saveBirthday = (date: { month: number; day: number }) =>
    act(
      () => dashboardApi.staffBirthdayDate({ cardId: card.cardId, ...date }),
      () => {
        setBirthdayEdit(null);
        setMessage({ tone: "ok", text: "Birthday saved." });
      },
    );
  const topTier = card.tiers[card.tiers.length - 1];

  return (
    <div className="staff-panel">
      <Link className="till-back" href="/staff">
        <ChevronLeft aria-hidden /> Scan another card
      </Link>

      <section className="till-card" aria-label={`${name}'s card`}>
        <div className="till-card-head">
          <span className="till-avatar" aria-hidden>
            {initials(name)}
          </span>
          <div>
            <h1>{name}</h1>
            <p>
              Member since {since} · {card.visits} visit{card.visits === 1 ? "" : "s"}
            </p>
            {card.asksBirthday && !birthdayEdit && (
              <p className="till-birthday-line">
                {birthdayText ? `Birthday ${birthdayText}` : "No birthday yet"} ·{" "}
                <button type="button" className="till-link" onClick={() => setBirthdayEdit(card.birthdayDate ?? { month: 1, day: 1 })}>
                  {birthdayText ? "Correct it" : "Add it"}
                </button>
              </p>
            )}
          </div>
        </div>
        <div className="till-count-row">
          <span className="till-card-count" aria-live="polite">
            {card.stamps}
            <span> of {card.goal} stamps</span>
          </span>
          {topTier && (
            <span className="till-goal">
              {topTier.rewardName} at {topTier.stampsRequired}
            </span>
          )}
        </div>
        {birthdayEdit && (
          <form
            className="till-birthday-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void saveBirthday(birthdayEdit);
            }}
          >
            <span>Birthday, as the guest tells you:</span>
            <select
              className="select"
              aria-label="Month"
              value={birthdayEdit.month}
              onChange={(event) => {
                const month = Number(event.target.value);
                setBirthdayEdit({ month, day: Math.min(birthdayEdit.day, daysInMonth(month)) });
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString("en-IN", { month: "long" })}
                </option>
              ))}
            </select>
            <select className="select" aria-label="Day" value={birthdayEdit.day} onChange={(event) => setBirthdayEdit({ ...birthdayEdit, day: Number(event.target.value) })}>
              {Array.from({ length: daysInMonth(birthdayEdit.month) }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button type="submit" className="staff-btn staff-btn-primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="till-link" onClick={() => setBirthdayEdit(null)}>
              Cancel
            </button>
          </form>
        )}
        {card.goal > 0 && (
          <ol className="till-dots" style={{ gridTemplateColumns: `repeat(${Math.min(card.goal, DOTS_PER_ROW)}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: Math.min(card.goal, 30) }, (_, i) => (
              <li key={i} className={i < card.stamps ? "on" : ""} />
            ))}
          </ol>
        )}
        {card.birthday && (
          <div className={`till-ready till-birthday${card.birthday.given ? " given" : ""}`}>
            <Cake aria-hidden />
            <span>
              <strong>{card.birthday.given ? "Birthday reward given" : "Birthday today"}</strong>
              <span>{card.birthday.reward}</span>
            </span>
          </div>
        )}
        {unlocked.map((tier) => (
          <div key={tier.index} className="till-ready">
            <Gift aria-hidden />
            <span>
              <strong>Reward ready</strong>
              <span>{tier.rewardName}</span>
            </span>
          </div>
        ))}
      </section>

      {card.stampedMinutesAgo !== null && !confirmAnother && (
        <p className="till-hint till-recent">
          Stamped {card.stampedMinutesAgo === 0 ? "just now" : `${card.stampedMinutesAgo} minute${card.stampedMinutesAgo === 1 ? "" : "s"} ago`}. Only add another if they&apos;ve bought a second drink.
        </p>
      )}
      {message && (
        <div className={`notice notice-${message.tone}`} role="status">
          {message.text}
        </div>
      )}
      {confirmAnother && (
        <div className="till-warn" role="alert">
          <AlertTriangle aria-hidden />
          <span>{confirmAnother}</span>
          <button type="button" className="staff-btn staff-btn-ghost" onClick={() => stamp(true)} disabled={busy}>
            Yes, add stamp
          </button>
        </div>
      )}

      <div className="till-actions">
        {room === 0 ? (
          <p className="till-hint">This card is full. Redeem the reward to start collecting again.</p>
        ) : (
          <>
            <button type="button" className="staff-btn staff-btn-primary staff-btn-xl" disabled={busy} onClick={() => stamp()}>
              {busy ? <Loader2 className="spin" aria-hidden /> : <Plus aria-hidden />}
              {count === 1 ? (card.stampedMinutesAgo !== null ? "Add another stamp" : "Add a stamp") : `Add ${count} stamps`}
            </button>
            <div className="till-stepper" aria-label="Stamps to add">
              <button type="button" aria-label="Fewer stamps" disabled={busy || count <= 1} onClick={() => setCount((c) => c - 1)}>
                <Minus aria-hidden />
              </button>
              <span aria-live="polite">
                {count} stamp{count === 1 ? "" : "s"} for this order
              </span>
              <button type="button" aria-label="More stamps" disabled={busy || count >= Math.min(5, room)} onClick={() => setCount((c) => c + 1)}>
                <Plus aria-hidden />
              </button>
            </div>
          </>
        )}

        {card.birthday && !card.birthday.given && (
          <button
            type="button"
            className="staff-btn staff-btn-secondary"
            disabled={busy}
            onClick={() => {
              const reward = card.birthday!.reward;
              void act(
                () => dashboardApi.staffBirthday({ cardId: card.cardId }),
                () => setMessage({ tone: "ok", text: `${reward}: given. Happy birthday, ${name}!` }),
              );
            }}
          >
            <Cake aria-hidden /> Give birthday reward
          </button>
        )}

        <div className="till-pair">
          {unlocked.length > 0 ? (
            unlocked.map((tier) => (
              <button
                key={tier.index}
                type="button"
                className="staff-btn staff-btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Give ${tier.rewardName} now? This uses ${tier.stampsRequired} stamps.`)) return;
                  void act(
                    () => dashboardApi.staffRedeem({ cardId: card.cardId, tierIndex: tier.index }),
                    () => setMessage({ tone: "ok", text: `${tier.rewardName} redeemed. Enjoy!` }),
                  );
                }}
              >
                <Gift aria-hidden /> Redeem reward
              </button>
            ))
          ) : (
            <button type="button" className="staff-btn staff-btn-secondary" disabled>
              <Gift aria-hidden /> Redeem reward
            </button>
          )}
          <button type="button" className="staff-btn staff-btn-ghost till-undo" disabled={busy || !card.undoable} onClick={undo}>
            <Undo2 aria-hidden /> Undo
          </button>
        </div>
      </div>
    </div>
  );
}
