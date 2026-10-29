"use client";

import { Cake, QrCode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeleteMyCard } from "@/components/card/CardLive";
import { recentCardView, rememberCardView } from "@/components/card/card-cache";
import { useCardChanges } from "@/components/card/useCardChanges";
import { InviteFriend } from "@/components/card/InviteFriend";
import { api, ApiRequestError } from "@/lib/api/client";
import type { MemberCardView } from "@/lib/api/contracts";
import { deviceMemory, type CardCredentials } from "@/lib/browser";
import { useLanding } from "../LandingContext";

const MAX_DRAWN_STAMPS = 20;

/**
 * The member's card, right on the venue's page: stamps, rewards, the code
 * staff scan, and the invite link. While it's on screen a cheap check
 * notices changes made at the till, and only then is the card fetched again.
 */
export function MyCard({ credentials, active = true, onMissing }: { credentials: CardCredentials; active?: boolean; onMissing?: () => void }) {
  const { venue, t, tf, track } = useLanding();
  // The grid's card tile may have fetched it moments ago: open with that.
  const [card, setCard] = useState<MemberCardView | null>(() => recentCardView(credentials.cardId));
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const known = useRef<number | null>(card?.stamps ?? null);

  const missing = useCallback(() => {
    // The card was removed (or the venue reset it): stop showing it here.
    deviceMemory.forgetCard(venue.id);
    onMissing?.();
  }, [venue.id, onMissing]);

  // The whole card; on first open and whenever the till changed it.
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);
  const load = useCallback(async () => {
    try {
      const next = await api.getCard(credentials.cardId, credentials.token);
      if (stopped.current) return;
      if (known.current !== null && next.stamps !== known.current) {
        setToast(next.stamps > known.current ? tf("card_stamp_added", { count: next.stamps - known.current }) : t("card_reward_used"));
        setTimeout(() => setToast(null), 4000);
      }
      known.current = next.stamps;
      rememberCardView(next);
      setCard(next);
      setFailed(false);
    } catch (error) {
      if (stopped.current) return;
      if (error instanceof ApiRequestError && error.status === 404) missing();
      setFailed(true);
    }
  }, [credentials.cardId, credentials.token, t, tf, missing]);

  useEffect(() => {
    if (active && !recentCardView(credentials.cardId)) void load();
  }, [active, load, credentials.cardId]);

  useCardChanges({
    cardId: credentials.cardId,
    token: credentials.token,
    active,
    knownStamps: card?.stamps ?? null,
    onChange: () => void load(),
    onMissing: missing,
  });

  if (!card) return <p className="sub-text my-card-status">{failed ? t("card_not_found") : t("loading")}</p>;

  const ready = [...card.tiers].reverse().find((tier) => tier.unlocked);
  const stamped = Math.min(card.stamps, card.goal);
  const left = card.goal - stamped;

  return (
    <div className="my-card">
      {toast && (
        <div className="card-toast" role="status">
          {toast}
        </div>
      )}
      <div className="my-card-head">
        <span className="my-card-holder">
          {card.holder ? tf("card_greeting", { name: card.holder }) : t("card_title")}
          {card.goal > 0 && ` · ${tf("card_progress", { stamps: stamped, required: card.goal })}`}
        </span>
        {card.goal > 0 && left > 0 && <span className="my-card-left">{tf("card_to_go", { count: left })}</span>}
      </div>
      {card.goal > 0 && venue.loyaltyProgram?.stampRule && <p className="my-card-rule">{venue.loyaltyProgram.stampRule}</p>}

      {card.goal > 0 && card.goal <= MAX_DRAWN_STAMPS && (
        <ol className="stamp-dots" aria-label={tf("card_progress", { stamps: stamped, required: card.goal })}>
          {Array.from({ length: card.goal }, (_, i) => (
            <li key={i} className={i < card.stamps ? "on" : ""}>
              {i < card.stamps && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </li>
          ))}
        </ol>
      )}
      {ready && <p className="member-card-ready">{tf("card_reward_ready", { reward: ready.rewardName })}</p>}
      {card.offers?.welcome && <p className="member-card-ready">{tf("card_welcome_offer", { offer: card.offers.welcome })}</p>}
      {card.offers && card.offers.ready > 0 && (
        <p className="member-card-ready">
          {card.offers.ready === 1 ? tf("card_friend_reward", { reward: card.offers.member }) : tf("card_friend_rewards", { count: card.offers.ready, reward: card.offers.member })}
        </p>
      )}
      {card.birthdayTreat && (
        <p className="member-card-ready member-card-birthday">
          <Cake aria-hidden />
          {tf("card_birthday_treat", { treat: card.birthdayTreat.replace(/[.!]+$/, "") })}
        </p>
      )}

      {card.tiers.length > 0 && card.goal > 0 && (
        <ul className="tier-ladder">
          {card.tiers.map((tier) => (
            <li key={`${tier.rewardName}-${tier.stampsRequired}`} className={tier.unlocked ? "ready" : ""}>
              <span className="tier-dot">{tier.stampsRequired}</span>
              <span className="tier-name">{tier.rewardName}</span>
              <span className="tier-state">{tier.unlocked ? t("card_tier_ready") : tf("card_tier_to_go", { count: tier.stampsRequired - card.stamps })}</span>
            </li>
          ))}
        </ul>
      )}

      {card.staffQrSvg && (
        <div className="card-staff">
          {showCode ? (
            <>
              <span className="card-staff-label">{t("card_show_staff")}</span>
              <div className="card-staff-qr" dangerouslySetInnerHTML={{ __html: card.staffQrSvg }} />
              <p className="sheet-footnote">{t("card_staff_hint")}</p>
              <button type="button" className="card-staff-btn secondary" onClick={() => setShowCode(false)}>
                {t("card_hide_staff")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="card-staff-btn"
              onClick={() => {
                setShowCode(true);
                track("card_staff_code_shown", { context: "landing" });
              }}
            >
              <QrCode aria-hidden />
              {t("card_show_staff")}
            </button>
          )}
        </div>
      )}

      {card.invite && (
        <InviteFriend
          url={card.invite.url}
          venueName={card.venueName}
          labels={{
            title: t("card_invite_title"),
            body: card.offers
              ? tf("card_invite_offer", { member: card.offers.member, friend: card.offers.friend })
              : tf("card_invite_body", { stamps: card.invite.referrerStamps }) +
                (card.invite.friendStamps > 0 ? ` ${tf("card_invite_friend", { stamps: card.invite.friendStamps })}` : ""),
            share: t("card_invite_share"),
            copied: t("copied"),
          }}
        />
      )}

      <div className="my-card-links">
        <p className="rc-different">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              deviceMemory.forgetCard(venue.id);
              onMissing?.();
            }}
          >
            {card.holder ? tf("rc_not_you", { name: card.holder }) : t("rc_different_card")}
          </button>
        </p>
        <DeleteMyCard
          venueId={venue.id}
          shortCode={venue.shortCode}
          cardId={credentials.cardId}
          token={credentials.token}
          labels={{ action: t("rc_delete"), confirm: tf("rc_delete_confirm", { business: venue.name }), done: t("rc_deleted"), failed: t("something_wrong") }}
          onDeleted={onMissing}
        />
      </div>
    </div>
  );
}

/** Joined just now (e.g. after feedback or the Wi-Fi offer): open the card in place rather than a new page. */
export function MyCardToggle({ credentials }: { credentials: CardCredentials }) {
  const { t } = useLanding();
  const [open, setOpen] = useState(false);
  return open ? (
    <MyCard credentials={credentials} />
  ) : (
    <button type="button" className="card-open-btn" onClick={() => setOpen(true)}>
      {t("view_card")}
    </button>
  );
}
