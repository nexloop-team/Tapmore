import type { ExternalLink, PublicVenue, VenueBranding } from "./types";

export type CoreFeature = "loyalty" | "menu" | "wifi" | "sudoku" | "feedback" | "google_review";
export type LinkFeature = `link:${string}`;
export type FeatureKey = CoreFeature | LinkFeature;

/** Returns the value only for http(s) URLs; everything else (javascript:, data:, relative) is null. */
export function sanitiseExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return lower.startsWith("https://") || lower.startsWith("http://") ? value.trim() : null;
}

/**
 * Merchant images: http(s) or a same-origin path. Protocol-relative and other
 * schemes are dropped, except blob: URLs, which only exist in this browser:
 * setup's live preview shows photos the owner just picked, before uploading
 * them. A saved config can never hold one (the schema refuses them).
 */
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (trimmed.startsWith("blob:")) return trimmed;
  return sanitiseExternalUrl(trimmed);
}

/** The announcement to show today, or null once its last day (`until`, inclusive) has passed. */
export function liveAnnouncement(announcement: PublicVenue["announcement"], today: string): PublicVenue["announcement"] {
  const text = announcement?.text?.trim();
  if (!text) return null;
  if (announcement?.until && announcement.until < today) return null;
  return { text, until: announcement?.until ?? null };
}

/** A stamp card programme (the common case). */
export function hasLoyaltyProgram(venue: PublicVenue): boolean {
  return isStampCard(venue.loyaltyProgram);
}

/** The same check on the programme alone, for code that hasn't loaded the whole venue. */
export function isStampCard(lp: PublicVenue["loyaltyProgram"] | undefined): boolean {
  return !!lp && lp.stampsEnabled !== false && !!lp.rewardName;
}

/** A membership with no stamps: joining mints a pass that rewards are sent to. */
export function isRewardsOnly(venue: PublicVenue): boolean {
  return venue.loyaltyProgram?.stampsEnabled === false;
}

/**
 * "Refer a friend" without a stamp card: members get an invite link, an
 * invited friend a welcome offer on their first visit, and the inviter a
 * reward for each friend who comes in. Staff give both at the till.
 */
export function isReferralOnly(venue: Pick<PublicVenue, "loyaltyProgram">): boolean {
  const lp = venue.loyaltyProgram;
  return !!lp && lp.stampsEnabled === false && !!lp.referralOffers?.friend && !!lp.referralOffers?.member;
}

/** Members have a card staff scan at the till: a stamp card, or refer-a-friend offers. */
export function hasTillCard(venue: PublicVenue): boolean {
  return hasLoyaltyProgram(venue) || isReferralOnly(venue);
}

export function primaryMenu(venue: PublicVenue) {
  return venue.menus[0] ?? null;
}

export function menuExternalUrl(venue: PublicVenue): string | null {
  const raw = primaryMenu(venue)?.externalUrl;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export function hasMenu(venue: PublicVenue): boolean {
  const external = menuExternalUrl(venue);
  if (external) return sanitiseExternalUrl(external) !== null;
  return venue.menus.some((menu) => menu.sections.some((section) => section.items.length > 0));
}

export function hasWifi(venue: PublicVenue): boolean {
  return (venue.wifi?.ssid ?? "").trim().length > 0;
}

export function hasGoogleReview(venue: PublicVenue): boolean {
  return !!venue.branding.showGoogleReviewButton && !!sanitiseExternalUrl(venue.socialLinks.google);
}

/** The owner switched on "Email for Wi-Fi": guests give an email before the password shows. */
export function wifiGateActive(venue: PublicVenue): boolean {
  return venue.crm.enabled && venue.crm.wifiCapture && hasWifi(venue);
}

/**
 * The venue as it may be sent to a guest's browser. Behind the email gate the
 * Wi-Fi password stays on the server until the guest has given an email
 * (see /api/guests/wifi).
 */
export function guestSafeVenue(venue: PublicVenue): PublicVenue {
  if (!wifiGateActive(venue) || !venue.wifi) return venue;
  return { ...venue, wifi: { ...venue.wifi, password: null } };
}

export function birthdayAskOn(venue: Pick<PublicVenue, "crm">): boolean {
  return venue.crm.enabled && venue.crm.birthdayAsk;
}

/**
 * The age a guest confirms before saying yes to offers. In India everyone
 * under 18 is a child under the DPDP Act (their data needs a parent's
 * consent), so Indian venues always ask for 18+. Elsewhere pubs and bars ask
 * 18+, everyone else 13+.
 */
export function consentAgeThreshold(venue: PublicVenue): 13 | 18 {
  if (venue.currencyCode === "INR") return 18;
  const type = (venue.venueType ?? "").trim().toLowerCase();
  return type === "pub" || type === "bar" ? 18 : 13;
}

/**
 * The cards this venue can show, in default order. Availability is decided
 * here; `applyFeatureOrder` may only reorder the result.
 */
export function buildFeatures(venue: PublicVenue, options: { preview?: boolean } = {}): FeatureKey[] {
  const features: FeatureKey[] = [];
  if (hasLoyaltyProgram(venue) || isRewardsOnly(venue)) features.push("loyalty");
  // Guests only see a menu with something in it; the owner's preview shows where it will go.
  if (hasMenu(venue) || (options.preview && venue.menus.length > 0)) features.push("menu");
  if (hasWifi(venue)) features.push("wifi");
  if (venue.branding.sudokuEnabled !== false) features.push("sudoku");
  features.push("feedback");
  if (hasGoogleReview(venue)) features.push("google_review");
  for (const link of venue.externalLinks) {
    if (link.id && sanitiseExternalUrl(link.url)) features.push(`link:${link.id}`);
  }
  const hidden = new Set(venue.branding.hiddenFeatures ?? []);
  return applyFeatureOrder(
    features.filter((key) => !hidden.has(key)),
    venue.branding.featureOrder,
  );
}

/** The merchant's own label for a core card, or null to use the default wording. */
export function customFeatureLabel(venue: PublicVenue, key: CoreFeature): string | null {
  return venue.branding.featureLabels?.[key]?.trim() || null;
}

/**
 * Keys named in `order` come first, in that order; everything else keeps its
 * default position behind them. An order can never add or drop a card.
 */
export function applyFeatureOrder(features: FeatureKey[], order: VenueBranding["featureOrder"]): FeatureKey[] {
  if (!Array.isArray(order) || order.length === 0) return features;
  const ordered: FeatureKey[] = [];
  for (const raw of order) {
    const key = (raw === "googleReview" ? "google_review" : raw) as FeatureKey;
    if (features.includes(key) && !ordered.includes(key)) ordered.push(key);
  }
  for (const key of features) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

export function findExternalLink(venue: PublicVenue, key: LinkFeature): ExternalLink | undefined {
  const id = key.slice("link:".length);
  return venue.externalLinks.find((link) => link.id === id);
}

/** Title to draw, or null to draw none. Whitespace-only override hides it. */
export function resolvedTitle(branding: VenueBranding, venueName: string): string | null {
  const override = branding.titleOverride;
  if (typeof override === "string" && override !== "") {
    const trimmed = override.trim();
    return trimmed === "" ? null : trimmed;
  }
  const name = venueName.trim();
  return name === "" ? null : name;
}

/** The banner photos to show, first first: the gallery (up to 5), or the single cover photo older pages have. */
export function coverImages(branding: VenueBranding): string[] {
  const list = [...(branding.coverImageUrls ?? []), branding.coverImageUrl].map(safeImageUrl).filter((url): url is string => !!url);
  return [...new Set(list)].slice(0, 5);
}

export function resolvedTagline(branding: VenueBranding): string | null {
  const tagline = typeof branding.tagline === "string" ? branding.tagline.trim() : "";
  return tagline === "" ? null : tagline;
}

export interface WifiView {
  ssid: string;
  password: string;
  security: string;
  isOpen: boolean;
  canCopyPassword: boolean;
}

export function wifiView(venue: PublicVenue): WifiView {
  const ssid = (venue.wifi?.ssid ?? "").trim();
  const password = (venue.wifi?.password ?? "").trim();
  const security = (venue.wifi?.security ?? "").trim();
  const lower = security.toLowerCase();
  const isOpen = lower === "open" || lower === "none" || lower === "nopass" || lower === "no password";
  return { ssid, password, security, isOpen, canCopyPassword: !isOpen && password.length > 0 };
}
