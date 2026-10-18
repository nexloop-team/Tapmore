"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createTracker } from "@/lib/analytics";
import { deviceMemory, parseCardCredentials, scrollMotion, subscribeStorage, type CardCredentials } from "@/lib/browser";
import { createTranslator, type Locale } from "@/lib/i18n";
import { linkLabel } from "@/lib/landing-copy";
import { rememberReferral } from "@/lib/referral";
import { usePreviewDraft } from "@/lib/live-preview";
import { computeTheme } from "@/lib/theme";
import {
  buildFeatures,
  customFeatureLabel,
  findExternalLink,
  isRewardsOnly,
  menuExternalUrl,
  primaryMenu,
  sanitiseExternalUrl,
  wifiGateActive,
  type FeatureKey,
  type LinkFeature,
} from "@/lib/venue/features";
import type { PublicVenue } from "@/lib/venue/types";
import { FeatureGlyphs, FilledHeart, GoogleG, LINK_ICON_TOKENS, LinkIconGlyph, MenuGlyph, type LinkIconToken } from "../icons";
import { AppDialog } from "./AppDialog";
import { ActionCard, ExpandableCard, LinkCard, useSheet, type TileSpec } from "./FeatureCard";
import { FeedbackTile, LinkTile, LoyaltyTile, MenuTile, ReviewTile, SudokuTile, tileSizes, useWifiCopy, WifiTile } from "./tiles";
import { useKnownGuestWifi } from "./wifi/useKnownGuestWifi";
import { FEEDBACK_TEXTAREA_ID, LandingContext, useLanding, type DialogContent, type LandingSession, type Membership } from "./LandingContext";
import { FeedbackSheet, LoyaltySheet, MyCard, preloadSheetsWhenIdle, RewardsSheet, SudokuSheet, WifiSheet } from "./lazy-sheets";
import { SocialLinks } from "./SocialLinks";
import { useGoogleReview } from "./useGoogleReview";
import { VenueHeader } from "./VenueHeader";

export type FeedbackVariant = "box" | "anon";

/** Cookie holding the feedback-card A/B bucket; read on the server so the label never flickers. */
export const FEEDBACK_VARIANT_COOKIE = "tt_cta";

const TINT = { loyalty: "#D94D66", menu: "#FF9500", wifi: "#4DC778", link: "#9C27B0" };

/**
 * iOS only raises the keyboard for a focus() made inside the tap itself, and
 * the textarea is still collapsed at that moment. Focus a throwaway input now
 * (keyboard opens), then hand focus to the textarea once the sheet has grown.
 */
function focusFeedbackKeepingKeyboard() {
  const temp = document.createElement("input");
  temp.setAttribute("aria-hidden", "true");
  temp.tabIndex = -1;
  Object.assign(temp.style, { position: "fixed", top: "0", left: "0", width: "0", height: "0", opacity: "0", border: "0", padding: "0", fontSize: "16px" });
  document.body.appendChild(temp);
  temp.focus({ preventScroll: true });
  // The sheet's code may still be on its way on a slow connection: keep looking for a few seconds.
  const started = Date.now();
  const handOver = () => {
    const area = document.getElementById(FEEDBACK_TEXTAREA_ID);
    if (area) {
      area.focus({ preventScroll: true });
      area.scrollIntoView({ behavior: scrollMotion(), block: "center" });
    } else if (Date.now() - started < 4000) {
      setTimeout(handOver, 150);
      return;
    }
    temp.remove();
  };
  setTimeout(handOver, 500);
}

/** "2026-10-12" → "12 Oct" in the guest's language. */
function shortDate(isoDay: string, locale: Locale): string {
  const date = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

function linkIconToken(icon: string | null | undefined): LinkIconToken {
  return (LINK_ICON_TOKENS as readonly string[]).includes(icon ?? "") ? (icon as LinkIconToken) : "link";
}

const MENU_ICONS: Record<string, keyof typeof FeatureGlyphs> = {
  view_price_list: "list",
  our_services: "list",
  book_now: "calendar",
  visit_website: "globe",
  order_online: "cart",
};

function MenuCardIcon({ token, custom }: { token: string | null | undefined; custom: boolean }) {
  if (custom) return <FeatureGlyphs.link aria-hidden strokeWidth={2} />;
  const glyph = token ? MENU_ICONS[token] : undefined;
  if (!glyph) return <MenuGlyph />;
  const Icon = FeatureGlyphs[glyph];
  return <Icon aria-hidden strokeWidth={2} />;
}

/** Polls only while the sheet is open. */
function MyCardSheet({ credentials, onMissing }: { credentials: CardCredentials; onMissing: () => void }) {
  const { isOpen } = useSheet();
  return (
    <div className="sheet-inner">
      <MyCard credentials={credentials} active={isOpen} onMissing={onMissing} />
    </div>
  );
}

function FeatureList({ features }: { features: FeatureKey[] }) {
  const { venue, t, track, theme, feedbackVariant } = useLanding();
  const review = useGoogleReview();
  const router = useRouter();
  // A member who joined (or opened their card link) on this device sees their card here,
  // including when the link from their email opened in another tab while this page was open.
  const storedCardRaw = useSyncExternalStore(subscribeStorage, () => deviceMemory.cardRaw(venue.id), () => null);
  // A stored card the server no longer knows; a different card saved later still shows.
  const [goneRaw, setGoneRaw] = useState<string | null>(null);
  const storedCard = useMemo(() => (goneRaw !== null && goneRaw === storedCardRaw ? null : parseCardCredentials(storedCardRaw)), [storedCardRaw, goneRaw]);
  const forgetCard = useCallback(() => setGoneRaw(storedCardRaw), [storedCardRaw]);
  const memberWifi = useKnownGuestWifi(storedCard);
  const wifiCopy = useWifiCopy(memberWifi.password);

  // Grid layout: bento tiles in the venue's tile shades, opening bottom sheets.
  const bento = venue.branding.layout === "grid";
  const sizes = useMemo(() => (bento ? tileSizes(features) : {}), [bento, features]);
  const tile = (feature: string, tone: TileSpec["tone"], content: ReactNode): TileSpec | undefined => (bento ? { tone, size: sizes[feature] ?? "small", content } : undefined);

  // The sheets' code arrives after the page; fetch the ones this page shows while the phone is idle.
  const hasCard = !!storedCard && !isRewardsOnly(venue);
  useEffect(() => {
    const sheets = features.flatMap((feature) => {
      if (feature === "loyalty") return [hasCard ? MyCard : isRewardsOnly(venue) ? RewardsSheet : LoyaltySheet];
      if (feature === "wifi") return [WifiSheet];
      if (feature === "feedback") return [FeedbackSheet];
      return [];
    });
    // The puzzle is the least likely to be opened, so it comes last.
    if (features.includes("sudoku")) sheets.push(SudokuSheet);
    return preloadSheetsWhenIdle(sheets);
  }, [features, hasCard, venue]);

  // The hosted menu is the most-tapped card: fetch its code and loading screen ahead, so the tap answers at once.
  const hostedMenu = features.includes("menu") && !sanitiseExternalUrl(menuExternalUrl(venue));
  useEffect(() => {
    if (hostedMenu) router.prefetch(`/menu${window.location.search}`);
  }, [hostedMenu, router]);

  return (
    <div className={`feature-grid${bento ? " bento" : ""}`}>
      {features.map((feature, position) => {
        const tapped = () => track("feature_card_tapped", { feature: feature.startsWith("link:") ? "link" : feature });

        switch (feature) {
          case "loyalty":
            if (storedCard && !isRewardsOnly(venue)) {
              return (
                <ExpandableCard
                  key={feature}
                  feature={feature}
                  label={t("feature_my_card")}
                  icon={<FilledHeart />}
                  tint={TINT.loyalty}
                  tile={tile(feature, "hero", <LoyaltyTile label={t("feature_my_card")} credentials={storedCard} />)}
                  onIntent={MyCard.preload}
                  onToggle={(open) => {
                    if (open) tapped();
                  }}
                >
                  <MyCardSheet credentials={storedCard} onMissing={forgetCard} />
                </ExpandableCard>
              );
            }
            const loyaltyLabel = customFeatureLabel(venue, "loyalty") ?? t(isRewardsOnly(venue) ? "feature_members_club" : "feature_loyalty");
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={loyaltyLabel}
                icon={<FilledHeart />}
                tint={TINT.loyalty}
                tile={tile(feature, "hero", <LoyaltyTile label={loyaltyLabel} credentials={null} />)}
                onIntent={isRewardsOnly(venue) ? RewardsSheet.preload : LoyaltySheet.preload}
                onToggle={(open) => {
                  if (!open) return;
                  tapped();
                  if (isRewardsOnly(venue)) track("rewards_join_shown", { context: "home" });
                  else track("loyalty_signup_shown");
                }}
              >
                {isRewardsOnly(venue) ? <RewardsSheet /> : <LoyaltySheet />}
              </ExpandableCard>
            );

          case "menu": {
            const menu = primaryMenu(venue);
            const external = sanitiseExternalUrl(menuExternalUrl(venue));
            const custom = !!menu?.linkLabelCustom?.trim();
            const menuLabel = customFeatureLabel(venue, "menu") ?? linkLabel(menu?.linkLabelToken, menu?.linkLabelCustom, t, "feature_menu");
            return (
              <ActionCard
                key={feature}
                feature={feature}
                label={menuLabel}
                icon={<MenuCardIcon token={menu?.linkLabelToken} custom={custom} />}
                tint={TINT.menu}
                tile={tile(feature, "pale", <MenuTile label={menuLabel} />)}
                onActivate={() => {
                  tapped();
                  if (external) {
                    track("menu_external_url_tapped", { label_token: menu?.linkLabelToken ?? null, is_custom: custom });
                    // Without "noopener" in the features string, a blocked popup is detectable (null).
                    const opened = window.open(external, "_blank");
                    if (opened) opened.opener = null;
                    else window.location.href = external;
                    return;
                  }
                  router.push(`/menu${window.location.search}`);
                }}
              />
            );
          }

          case "wifi": {
            const wifiLabel = customFeatureLabel(venue, "wifi") ?? t("feature_wifi");
            // A tile with nothing to ask first just copies the password: no gate, or a guest this phone already knows.
            if (bento && wifiCopy.canCopy && (!wifiGateActive(venue) || memberWifi.password)) {
              return (
                <ActionCard
                  key={feature}
                  feature={feature}
                  label={`${wifiLabel}: ${wifiCopy.status}`}
                  icon={null}
                  tint={null}
                  tile={tile(feature, "pop", <WifiTile label={wifiLabel} status={wifiCopy.status} unlocked={!!memberWifi.password} />)}
                  onActivate={() => {
                    tapped();
                    void wifiCopy.copy();
                    if (memberWifi.password) memberWifi.recordVisit();
                  }}
                />
              );
            }
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={wifiLabel}
                icon={<FeatureGlyphs.wifi aria-hidden strokeWidth={2} />}
                tint={TINT.wifi}
                tile={tile(feature, "pop", <WifiTile label={wifiLabel} status={t("tile_wifi_connect")} />)}
                onIntent={WifiSheet.preload}
                onToggle={(open) => open && tapped()}
              >
                <WifiSheet />
              </ExpandableCard>
            );
          }

          case "sudoku":
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={customFeatureLabel(venue, "sudoku") ?? t("feature_sudoku")}
                icon={<FeatureGlyphs.sudoku aria-hidden strokeWidth={2} />}
                tint={theme.isLightCards ? "#7D59D9" : "#B79BFF"}
                tile={tile(feature, "pale", <SudokuTile label={customFeatureLabel(venue, "sudoku") ?? t("tile_sudoku")} />)}
                onIntent={SudokuSheet.preload}
                onToggle={(open) => open && tapped()}
              >
                <SudokuSheet />
              </ExpandableCard>
            );

          case "feedback": {
            const Glyph = feedbackVariant === "anon" ? FeatureGlyphs.feedback : FeatureGlyphs.suggestionBox;
            const feedbackLabel = customFeatureLabel(venue, "feedback") ?? t(feedbackVariant === "anon" ? "feature_feedback_anon" : "feature_feedback_box");
            return (
              <ExpandableCard
                key={feature}
                feature={feature}
                label={feedbackLabel}
                icon={<Glyph aria-hidden strokeWidth={2} />}
                tint={theme.accentBlue}
                tile={tile(feature, "pale", <FeedbackTile label={feedbackLabel} />)}
                onIntent={FeedbackSheet.preload}
                onToggle={(open) => {
                  if (!open) return;
                  focusFeedbackKeepingKeyboard();
                  tapped();
                  track("feedback_cta_tapped", { variant: `cta_${feedbackVariant}` });
                  track("feedback_expanded");
                }}
              >
                <FeedbackSheet />
              </ExpandableCard>
            );
          }

          case "google_review": {
            const reviewLabel = customFeatureLabel(venue, "google_review") ?? t("feature_google_review");
            return (
              <ActionCard
                key={feature}
                feature={feature}
                label={reviewLabel}
                icon={<GoogleG />}
                tint={null}
                tile={tile(feature, "hero", <ReviewTile label={reviewLabel} />)}
                onActivate={() => {
                  tapped();
                  review.open("landing_page");
                }}
              />
            );
          }

          default: {
            const link = findExternalLink(venue, feature as LinkFeature);
            const href = sanitiseExternalUrl(link?.url);
            if (!link || !href) return null;
            const isCustom = !!link.labelCustom?.trim();
            const label = linkLabel(link.labelToken, link.labelCustom, t, "feature_menu_website");
            return (
              <LinkCard
                key={feature}
                href={href}
                label={label}
                icon={<LinkIconGlyph token={linkIconToken(link.icon)} />}
                tint={TINT.link}
                tile={tile(feature, "pale", <LinkTile label={label} icon={<LinkIconGlyph token={linkIconToken(link.icon)} />} />)}
                onClick={() => {
                  tapped();
                  track("external_link_tapped", { link_id: link.id, label_token: link.labelToken ?? null, is_custom: isCustom, position });
                }}
              />
            );
          }
        }
      })}
    </div>
  );
}

interface LandingAppProps {
  venue: PublicVenue;
  locale: Locale;
  /** The `s` query param: which QR code / table was scanned. */
  source: string;
  feedbackVariant: FeedbackVariant;
  /** The bucket was freshly drawn on the server and must be remembered. */
  persistVariant: boolean;
  /** Opened by the venue's own team (signed in): not counted as a guest visit. */
  team?: boolean;
}

/**
 * The customer landing page: header, feature cards, social row, footer.
 * The venue arrives server-rendered, so there is no loading flash and the
 * theme is already applied by the time this hydrates.
 */
export function LandingApp({ venue: savedVenue, locale, source, feedbackVariant, persistVariant, team = false }: LandingAppProps) {
  // In the editor's preview frame, the owner's unsaved changes show straight away.
  const draft = usePreviewDraft<Partial<PublicVenue>>(source === "preview");
  const venue = useMemo<PublicVenue>(() => (draft ? { ...savedVenue, ...draft, announcement: draft.announcement?.text ? draft.announcement : null } : savedVenue), [savedVenue, draft]);
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId: venue.id, source, page: "s", team }), [venue.id, source, team]);
  const theme = useMemo(() => computeTheme(venue.branding), [venue.branding]);

  // The saved colours arrive as a :root rule from the server; a draft overrides them in place.
  useEffect(() => {
    if (!draft) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(name, value);
  }, [draft, theme]);
  const features = useMemo(() => buildFeatures(venue), [venue]);

  // Device memory lives in localStorage, which the server can't see.
  const rememberedCustomerId = useSyncExternalStore(subscribeStorage, () => deviceMemory.customerId(venue.id), () => null);
  const [joinedCustomerId, setJoinedCustomerId] = useState<string | null>(null);
  const knownCustomerId = joinedCustomerId ?? rememberedCustomerId;
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loyaltyDone, setLoyaltyDoneState] = useState(false);
  const [dialog, setDialog] = useState<DialogContent | null>(null);

  // An invite link (`?ref=`) counts if the friend joins at any point in this visit.
  useEffect(() => rememberReferral(venue.id), [venue.id]);

  useEffect(() => {
    if (persistVariant) document.cookie = `${FEEDBACK_VARIANT_COOKIE}=${feedbackVariant}; path=/; max-age=31536000; SameSite=Lax`;
  }, [persistVariant, feedbackVariant]);

  useEffect(() => {
    track("screen_viewed", { screen_name: "landing" });
    track("landing_opened", { features_shown: features.join(","), landing_variant: `cta_${feedbackVariant}` });
    const external = menuExternalUrl(venue);
    if (external && !sanitiseExternalUrl(external)) track("menu_external_url_open_failed", { reason: "invalid_url" });
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const session = useMemo<LandingSession>(
    () => ({
      venue,
      locale,
      t,
      tf,
      track,
      source,
      theme,
      feedbackVariant,
      knownCustomerId,
      rememberCustomer: setJoinedCustomerId,
      membership,
      setMembership,
      loyaltyDone,
      setLoyaltyDone: () => setLoyaltyDoneState(true),
      showDialog: setDialog,
    }),
    [venue, locale, t, tf, track, source, theme, feedbackVariant, knownCustomerId, membership, loyaltyDone],
  );

  return (
    <LandingContext.Provider value={session}>
      <div
        className="landing"
        data-style={theme.style ?? undefined}
        data-layout={venue.branding.layout ?? "list"}
        data-header={venue.branding.headerStyle ?? "cover"}
        data-shape={venue.branding.buttonShape ?? "rounded"}
      >
        <main className="page-wrapper">
          <VenueHeader branding={venue.branding} name={venue.name} poster />
          {venue.announcement?.text && (
            <p className="announcement" role="note">
              <Megaphone aria-hidden />
              <span className="announcement-text">{venue.announcement.text}</span>
              {venue.announcement.until && <span className="announcement-until">{tf("announcement_until", { date: shortDate(venue.announcement.until, locale) })}</span>}
            </p>
          )}
          <FeatureList features={features} />
          <SocialLinks context="landing" className="landing-row" />
        </main>
      </div>
      <AppDialog content={dialog} okLabel={t("ok")} onClose={() => setDialog(null)} />
    </LandingContext.Provider>
  );
}
