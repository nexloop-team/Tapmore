"use client";

import { AlertTriangle, Cake, Check, ChevronLeft, Gift, Loader2, Minus, Plus, Undo2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useOffline } from "next/offline";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { StaffCardView } from "@/lib/api/staff-contracts";
import { initials } from "@/lib/format";
import { daysInMonth } from "@/lib/validation";
import { useConfirm } from "../dashboard/confirm";
import { ScanCardButton } from "./ScanCardButton";
import { enqueue, newRequestId, onQueuedSent, type TillAction } from "./till-queue";

type Queueable = Pick<TillAction, "kind"> & Partial<{ count: number; force: boolean; tierIndex: number; reward: string }>;

/** The card with `stamps` stamps (and its rewards unlocked to match): what the till shows before the server confirms. */
function withStamps(card: StaffCardView, stamps: number): StaffCardView {
  return { ...card, stamps, tiers: card.tiers.map((tier) => ({ ...tier, unlocked: stamps >= tier.stampsRequired })) };
}

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

  const confirm = useConfirm();
  const offline = useOffline();
  const name = card.guestName || "Guest";

  // A stamp queued while offline reached the server: show the card as it really is now.
  useEffect(() => onQueuedSent((cardId, view) => cardId === initial.cardId && setCard(view)), [initial.cardId]);

  /**
   * Runs a till action; `rollback` undoes what the screen already showed if
   * the server says no. A stamp, redeem or undo (`queue`) made without a
   * connection is kept on the till and sent when it's back, the screen
   * showing it as done (`local`) meanwhile.
   */
  async function act(
    run: (requestId: string) => Promise<StaffCardView>,
    done: (next: StaffCardView) => void,
    rollback?: () => void,
    queue?: { action: Queueable; local: StaffCardView; after?: () => void },
  ) {
    const requestId = newRequestId();
    const keepForLater = () => {
      enqueue({ ...queue!.action, id: requestId, cardId: card.cardId, guest: name, at: Date.now() } as TillAction);
      setCard(queue!.local);
      setCount(1);
      queue!.after?.();
      setMessage({ tone: "ok", text: "No connection: saved on this till. It goes through as soon as you're back online (within 2 minutes)." });
    };
    setMessage(null);
    setConfirmAnother(null);
    if (queue && offline) return keepForLater();
    setBusy(true);
    try {
      const next = await run(requestId);
      setCard(next);
      setCount(1);
      done(next);
    } catch (error) {
      if (queue && error instanceof ApiRequestError && error.status === 0) return keepForLater();
      rollback?.();
      if (error instanceof ApiRequestError && error.status === 409) setConfirmAnother(error.message);
      else setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Stamp added" shows the moment it's tapped and the server confirms behind
   * it; a refusal puts the card back as it was, with the reason. Not inside
   * the cooldown, where the server asks "add another anyway?" first.
   */
  const stamp = (force = false) => {
    const before = card;
    const adding = Math.min(count, Math.max(0, card.goal - card.stamps));
    // Offline, the till asks the cooldown question itself (the server can't).
    if (offline && !force && card.stampedMinutesAgo !== null) {
      setConfirmAnother(`This card was stamped ${card.stampedMinutesAgo === 0 ? "just now" : `${card.stampedMinutesAgo} min ago`}. Add another anyway?`);
      return;
    }
    const instant = adding > 0 && (force || card.stampedMinutesAgo === null);
    if (instant) {
      const stamps = card.stamps + adding;
      setCard({
        ...card,
        stamps,
        tiers: card.tiers.map((tier) => ({ ...tier, unlocked: stamps >= tier.stampsRequired })),
        // Shown (disabled while saving) so the button doesn't jump in when the server answers.
        undoable: { kind: "stamp", delta: adding, rewardName: null },
      });
      setStamped(adding);
    }
    return act(
      (requestId) => dashboardApi.staffStamp({ cardId: card.cardId, count, force, requestId }),
      // The real count; but if staff already moved on from "Stamp added", don't bring it back.
      (next) => setStamped((shown) => (instant && shown === null ? null : next.stamps - before.stamps)),
      instant
        ? () => {
            setCard(before);
            setStamped(null);
          }
        : undefined,
      { action: { kind: "stamp", count, force: true }, local: { ...withStamps(before, before.stamps + adding), undoable: null, stampedMinutesAgo: 0 }, after: () => setStamped(adding) },
    );
  };
  const undo = () =>
    act(
      (requestId) => dashboardApi.staffUndo({ cardId: card.cardId, requestId }),
      () => {
        setStamped(null);
        setMessage({ tone: "ok", text: "Undone." });
      },
      undefined,
      // Refer-a-friend offers aren't kept on the till offline: what an undo gives back is the server's to work out.
      card.offers ? undefined : { action: { kind: "undo" }, local: { ...withStamps(card, Math.max(0, card.stamps - (card.undoable?.delta ?? 0))), undoable: null }, after: () => setStamped(null) },
    );
  const offers = card.offers;

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
        {offers ? (
          <p className="till-rule">Refer a friend: {offers.member} for each friend they invite who visits.</p>
        ) : (
          <>
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
            {card.stampRule && <p className="till-rule">{card.stampRule}</p>}
          </>
        )}
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
        {offers?.welcome && (
          <div className="till-ready">
            <UserPlus aria-hidden />
            <span>
              <strong>Invited by a friend: first visit</strong>
              <span>{offers.welcome}</span>
            </span>
          </div>
        )}
        {offers && offers.ready > 0 && (
          <div className="till-ready">
            <Gift aria-hidden />
            <span>
              <strong>{offers.ready === 1 ? "Friend reward ready" : `${offers.ready} friend rewards ready`}</strong>
              <span>{offers.member}</span>
            </span>
          </div>
        )}
        {!offers && card.goal > 0 && (
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

      {!offers && card.stampedMinutesAgo !== null && !confirmAnother && (
        <p className="till-hint till-recent">
          Stamped {card.stampedMinutesAgo === 0 ? "just now" : `${card.stampedMinutesAgo} minute${card.stampedMinutesAgo === 1 ? "" : "s"} ago`}. Only add another if they&apos;ve made a second purchase.
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

      {offers ? (
        <div className="till-actions">
          {offers.welcome && (
            <button
              type="button"
              className="staff-btn staff-btn-primary staff-btn-xl"
              disabled={busy}
              onClick={() =>
                void act(
                  (requestId) => dashboardApi.staffWelcome({ cardId: card.cardId, requestId }),
                  () => setMessage({ tone: "ok", text: `${offers.welcome}: given. Welcome, ${name}!` }),
                )
              }
            >
              {busy ? <Loader2 className="spin" aria-hidden /> : <UserPlus aria-hidden />} Give welcome offer
            </button>
          )}
          {offers.ready > 0 && (
            <button
              type="button"
              className="staff-btn staff-btn-secondary"
              disabled={busy}
              onClick={() =>
                void act(
                  (requestId) => dashboardApi.staffFriendReward({ cardId: card.cardId, requestId }),
                  () => setMessage({ tone: "ok", text: `${offers.member}: given. Thanks for the invite, ${name}!` }),
                )
              }
            >
              <Gift aria-hidden /> Give friend reward
            </button>
          )}
          {!offers.welcome && offers.ready === 0 && <p className="till-hint">Nothing to give today. Rewards show here when a friend they invited makes a first visit.</p>}
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
          <button type="button" className="staff-btn staff-btn-ghost till-undo" disabled={busy || !card.undoable} onClick={undo}>
            <Undo2 aria-hidden /> Undo
          </button>
        </div>
      ) : (
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
                onClick={async () => {
                  if (!(await confirm({ title: `Give ${tier.rewardName} now?`, body: `This uses ${tier.stampsRequired} stamps.`, confirmLabel: "Give reward" }))) return;
                  void act(
                    (requestId) => dashboardApi.staffRedeem({ cardId: card.cardId, tierIndex: tier.index, requestId }),
                    () => setMessage({ tone: "ok", text: `${tier.rewardName} redeemed. Enjoy!` }),
                    undefined,
                    { action: { kind: "redeem", tierIndex: tier.index, reward: tier.rewardName }, local: { ...withStamps(card, card.stamps - tier.stampsRequired), undoable: null } },
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
      )}
    </div>
  );
}
