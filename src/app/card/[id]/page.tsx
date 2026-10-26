import type { Metadata } from "next";
import { Suspense } from "react";
import { Cake, Check, Gift } from "lucide-react";
import { CardLive, DeleteMyCard, DifferentCard, OpenOnVenuePage } from "@/components/card/CardLive";
import { LandingError } from "@/components/landing/LandingError";
import { PausedPage } from "@/components/landing/PausedPage";
import { InviteFriend } from "@/components/card/InviteFriend";
import { ThemeStyle } from "@/components/ThemeStyle";
import { initials } from "@/lib/format";
import { createTranslator, type Locale, LOCALE } from "@/lib/i18n";
import { computeTheme } from "@/lib/theme";
import { hasLoyaltyProgram } from "@/lib/venue/features";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import { findCardForViewer } from "@/server/repositories/loyalty-cards";
import { ensureReferralCode } from "@/server/repositories/retention";
import { recentEvents, type StampEvent } from "@/server/repositories/stamps";
import { findPausedVenue, findVenue } from "@/server/repositories/venues";
import { firstParam, serverOrigin } from "@/server/request";
import { birthdayTreat } from "@/server/services/birthday";
import { qrSvg } from "@/server/services/qr";
import "@/styles/landing.css";
import "@/styles/pages.css";
import { parseDbDate } from "@/lib/plans";
import type { PublicVenue } from "@/lib/venue/types";

type ViewerCard = NonNullable<Awaited<ReturnType<typeof findCardForViewer>>>;

export const metadata: Metadata = {
  title: { absolute: "Your card" },
  robots: { index: false, follow: false },
  // The URL carries the card's access token; never send it onwards.
  referrer: "no-referrer",
};

/** Largest stamp grid drawn; bigger programmes show progress as text only. */
const MAX_DRAWN_STAMPS = 20;

function dayLabel(sqliteUtc: string, locale: Locale): string {
  const date = new Date(parseDbDate(sqliteUtc) ?? 0);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

/** One line of the card's history, or null for bookkeeping rows (undos, undone stamps). */
function historyLine(event: StampEvent, t: ReturnType<typeof createTranslator>["t"], tf: ReturnType<typeof createTranslator>["tf"]): string | null {
  if (event.undone_at || event.kind === "undo") return null;
  switch (event.kind) {
    case "stamp":
      return event.delta === 1 ? t("rc_ev_stamp") : tf("rc_ev_stamps", { count: event.delta });
    case "redeem":
      return tf("rc_ev_redeem", { reward: event.reward_name ?? "" });
    case "feedback":
      return t("rc_ev_feedback");
    case "referral":
      return tf("rc_ev_referral", { count: event.delta });
    case "birthday":
      return tf("rc_ev_birthday", { reward: event.reward_name ?? "" });
    default:
      return tf("rc_ev_bonus", { count: event.delta });
  }
}

/**
 * `/card/<id>?t=<token>` — the link in the member's card email. It teaches
 * this phone the card and moves on to the venue's own page, where the card
 * shows in place of the join form; the full page below is the fallback for a
 * browser that can't keep it.
 */
export default async function CardPage({ params, searchParams }: PageProps<"/card/[id]">) {
  const { id } = await params;
  const token = firstParam((await searchParams).t);
  const locale = LOCALE;
  const { t } = createTranslator(locale);

  const card = token ? await findCardForViewer(id, token) : null;
  const venue = card ? await findVenue(card.venue_id) : null;
  if (card && !venue) {
    const paused = await findPausedVenue(card.venue_id);
    if (paused) return <PausedPage locale={locale} name={paused.name} branding={paused.branding} retryHref={`/card/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`} />;
  }
  if (!card || !venue) return <LandingError locale={locale} message="card_not_found" source="card" />;

  const theme = computeTheme(venue.branding);

  return (
    <>
      <ThemeStyle branding={venue.branding} />
      <main className="page-wrapper rc-page" data-style={theme.style ?? undefined}>
        <OpenOnVenuePage venueId={venue.id} shortCode={venue.shortCode} cardId={card.id} token={token} opening={t("rc_opening")}>
          {/* Streams in after: a phone that keeps the card is already on its way to the venue's page. */}
          <Suspense fallback={null}>
            <CardBody card={card} venue={venue} token={token} locale={locale} />
          </Suspense>
        </OpenOnVenuePage>
      </main>
    </>
  );
}

/** The full card: shown only by a browser that can't keep the card for the venue's page. */
async function CardBody({ card, venue, token, locale }: { card: ViewerCard; venue: PublicVenue; token: string; locale: Locale }) {
  const { t, tf } = createTranslator(locale);
  const holder = card.first_name?.trim() || card.name?.trim() || "";
  const program = hasLoyaltyProgram(venue) ? venue.loyaltyProgram! : null;
  const tiers = programTiers(program);
  const goal = stampGoal(tiers);
  const stamps = Math.min(card.stamps, goal);
  // Staff scan this on a paired till device; the device pairing is what authorises the stamp.
  const origin = await serverOrigin();
  const referral = program?.referral?.enabled ? program.referral : null;
  // Independent lookups, side by side.
  const [staffQr, referralCode, events, birthday] = await Promise.all([
    program ? qrSvg(`${origin}/staff/stamp?c=${card.id}`) : null,
    referral ? ensureReferralCode(card.id) : null,
    recentEvents(card.id, 12),
    birthdayTreat(venue, card, card.birthday_month, card.birthday_day),
  ]);
  const inviteUrl = referralCode ? `${origin}/s?i=${encodeURIComponent(venue.shortCode)}&ref=${referralCode}&s=invite` : null;
  const history = events
    .map((event) => ({ event, line: historyLine(event, t, tf) }))
    .filter((row): row is { event: StampEvent; line: string } => !!row.line)
    .slice(0, 6);
  const nextTier = tiers.find((tier) => card.stamps < tier.stampsRequired);
  const readyTier = [...tiers].reverse().find((tier) => card.stamps >= tier.stampsRequired);
  const since = new Date(parseDbDate(card.created_at) ?? NaN);
  const sinceText = Number.isNaN(since.getTime()) ? "" : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(since);
  const code = `${initials(venue.name)} · ${card.id.slice(-4).toUpperCase()}`;

  return (
    <>
      <header className="rc-top">
        <h1>{t("rc_title")}</h1>
        <p>
          {program
            ? holder
              ? tf("rc_hi", { name: holder, stamps, required: goal })
              : tf("card_progress", { stamps, required: goal })
            : holder
              ? tf("rc_hi_member", { name: holder })
              : t("card_show_rewards")}
        </p>
      </header>

      <section className="rc-hero" aria-label={venue.name}>
        <div className="rc-hero-head">
          <span className="rc-venue">{venue.name}</span>
          <span className="rc-code">{code}</span>
        </div>
        {program ? (
          <>
            <div className="rc-count">
              <span className="rc-big" aria-label={tf("card_progress", { stamps, required: goal })}>
                {stamps}
                <small>/{goal}</small>
              </span>
              <span className="rc-pill">{readyTier ? tf("rc_ready", { reward: readyTier.rewardName.toLowerCase() }) : nextTier ? tf("tile_stamps_more", { count: nextTier.stampsRequired - card.stamps, reward: nextTier.rewardName.toLowerCase() }) : ""}</span>
            </div>
            {goal > 0 && goal <= MAX_DRAWN_STAMPS && (
              <ol className="rc-stamps" aria-hidden>
                {Array.from({ length: goal }, (_, i) => (
                  <li key={i} className={i < card.stamps ? "on" : ""}>
                    {i < card.stamps ? <Check /> : i === goal - 1 ? <Gift /> : i + 1}
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          sinceText && <p className="rc-since">{tf("card_member", { date: sinceText })}</p>
        )}
      </section>

      {birthday && !birthday.given && (
        <p className="member-card-ready member-card-birthday">
          <Cake aria-hidden />
          {tf("card_birthday_treat", { treat: birthday.reward.replace(/[.!]+$/, "") })}
        </p>
      )}

      <CardLive
        venueId={venue.id}
        cardId={card.id}
        token={token}
        stamps={card.stamps}
        qrSvg={staffQr}
        code={code}
        labels={{ title: t("rc_show_title"), show: t("card_show_staff"), hide: t("card_hide_staff"), hint: t("rc_hint"), added: t("card_stamp_added"), redeemed: t("card_reward_used") }}
      />

      {program && tiers.length > 0 && (
        <ul className="rc-tiers">
          {tiers.map((tier) => {
            const left = tier.stampsRequired - card.stamps;
            return (
              <li key={`${tier.rewardName}-${tier.stampsRequired}`}>
                <span className="rc-tier-icon" aria-hidden>
                  <Gift />
                </span>
                <span className="rc-tier-text">
                  <strong>{tier.rewardName}</strong>
                  <span>{tf("rc_at", { count: tier.stampsRequired })}</span>
                </span>
                <span className={`rc-chip${left <= 0 ? " ready" : ""}`}>{left <= 0 ? t("card_tier_ready") : tf("card_tier_to_go", { count: left })}</span>
              </li>
            );
          })}
        </ul>
      )}

      {referral && inviteUrl && (
        <InviteFriend
          url={inviteUrl}
          venueName={venue.name}
          labels={{
            title: t("card_invite_title"),
            body:
              referral.referrerStamps === 1 && referral.friendStamps === 1
                ? t("rc_invite_both")
                : tf("card_invite_body", { stamps: referral.referrerStamps }) + (referral.friendStamps > 0 ? ` ${tf("card_invite_friend", { stamps: referral.friendStamps })}` : ""),
            share: t("card_invite_share"),
            copied: t("copied"),
          }}
        />
      )}

      {history.length > 0 && (
        <section className="rc-history">
          <h2>{t("rc_history")}</h2>
          <ul>
            {history.map(({ event, line }) => (
              <li key={event.id}>
                <span>{line}</span>
                <span className="rc-history-date">{dayLabel(event.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DifferentCard venueId={venue.id} shortCode={venue.shortCode} label={holder ? tf("rc_not_you", { name: holder }) : t("rc_different_card")} />
      <DeleteMyCard
        venueId={venue.id}
        shortCode={venue.shortCode}
        cardId={card.id}
        token={token}
        labels={{ action: t("rc_delete"), confirm: tf("rc_delete_confirm", { business: venue.name }), done: t("rc_deleted"), failed: t("something_wrong") }}
      />
      <p className="rc-foot">
        © {new Date().getFullYear()} {venue.name} · <a href="/privacy">{t("rc_privacy")}</a>
      </p>
    </>
  );
}
