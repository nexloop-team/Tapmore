"use client";

import { sanitiseExternalUrl } from "@/lib/venue/features";
import type { SocialLinks as Links, PublicVenue, SocialStyle, VenueBranding } from "@/lib/venue/types";
import type { SocialPlatform } from "../icons";
import { LinkCard, type TileSpec } from "./FeatureCard";
import { useLanding } from "./LandingContext";
import { LinkTile } from "./tiles";

const ORDER: { platform: SocialPlatform; key: keyof Links; label: string }[] = [
  { platform: "facebook", key: "facebook", label: "Facebook" },
  { platform: "instagram", key: "instagram", label: "Instagram" },
  { platform: "tripadvisor", key: "tripAdvisor", label: "Tripadvisor" },
  { platform: "youtube", key: "youtube", label: "YouTube" },
];

/** Single-colour glyphs: they take the page's text colour, so they suit any venue colour. */
export function SocialGlyph({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M13.4 21v-7.6H16l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" />
        </svg>
      );
    case "tripadvisor":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <circle cx="7.5" cy="13" r="3.5" />
          <circle cx="16.5" cy="13" r="3.5" />
          <path d="M4 8.5c4.5-3 11.5-3 16 0" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="4" />
          <path d="M10.5 9.5v5l4-2.5z" fill="currentColor" />
        </svg>
      );
  }
}

/** Small round icons (the default), or a card each in the page's own layout. */
export function socialStyle(branding: Pick<VenueBranding, "socialStyle">): SocialStyle {
  return branding.socialStyle ?? "icons";
}

/** Each platform's own colour, for the icon on its card. */
const TINTS: Record<SocialPlatform | "phone", string> = {
  phone: "#34A853",
  facebook: "#1877F2",
  instagram: "#E1306C",
  tripadvisor: "#00AF87",
  youtube: "#FF0000",
};

export function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 7 7l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function hasSocialLinks(links: Links): boolean {
  return ORDER.some(({ key }) => !!sanitiseExternalUrl(links[key]));
}

/** "+91 98765 43210" → "tel:+919876543210"; null for anything that isn't a phone number. */
export function telLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : null;
}

export interface SocialCardItem {
  /** "social:instagram": unique beside the page's feature keys, for the bento sizes. */
  key: string;
  platform: SocialPlatform | "phone";
  label: string;
  href: string;
}

/** The call and each profile as cards, when the owner chose cards: they join the page's own cards (same grid, same bento). */
export function socialCards(venue: Pick<PublicVenue, "branding" | "phone" | "socialLinks">): SocialCardItem[] {
  if (socialStyle(venue.branding) !== "cards") return [];
  const tel = telLink(venue.phone);
  return [
    ...(tel ? [{ key: "social:phone", platform: "phone" as const, label: "Call", href: tel }] : []),
    ...ORDER.flatMap(({ platform, key, label }) => {
      const href = sanitiseExternalUrl(venue.socialLinks[key]);
      return href ? [{ key: `social:${platform}`, platform, label, href }] : [];
    }),
  ];
}

/** One call or profile card: a row with the platform's colour, or a bento tile (no arrow: the logo says where it goes). */
export function SocialCard({ card, size }: { card: SocialCardItem; size?: TileSpec["size"] }) {
  const { track } = useLanding();
  const icon = card.platform === "phone" ? <PhoneGlyph /> : <SocialGlyph platform={card.platform} />;
  return (
    <LinkCard
      href={card.href}
      newTab={card.platform !== "phone"}
      label={card.label}
      icon={icon}
      tint={TINTS[card.platform]}
      tile={size ? { tone: "pale", size, content: <LinkTile label={card.label} icon={icon} arrow={false} /> } : undefined}
      onClick={() => track("social_link_tapped", { social_platform: card.platform, from_context: "landing" })}
    />
  );
}

/** A call button (on the page, when the venue gives a phone number), then Facebook → Instagram → Tripadvisor → YouTube, each only with a safe http(s) URL. */
export function SocialLinks({ context, className = "" }: { context: "landing" | "thankyou"; className?: string }) {
  const { venue, track } = useLanding();
  const items = ORDER.map((item) => ({ ...item, url: sanitiseExternalUrl(venue.socialLinks[item.key]) })).filter((item) => item.url);
  const tel = context === "landing" ? telLink(venue.phone) : null;
  if (items.length === 0 && !tel) return null;
  // Shown as cards among the page's own cards instead (see socialCards).
  if (context === "landing" && socialStyle(venue.branding) === "cards") return null;

  return (
    <div className={`social-links ${className}`}>
      {tel && (
        <a className="social-call" href={tel} aria-label={`Call ${venue.phone}`} onClick={() => track("social_link_tapped", { social_platform: "phone", from_context: context })}>
          <PhoneGlyph />
          <span>Call</span>
        </a>
      )}
      {items.map((item) => (
        <a
          key={item.platform}
          href={item.url!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.label}
          onClick={() => track("social_link_tapped", { social_platform: item.platform, from_context: context })}
        >
          <SocialGlyph platform={item.platform} />
        </a>
      ))}
    </div>
  );
}
