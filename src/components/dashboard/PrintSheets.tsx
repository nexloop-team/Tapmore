import type { CSSProperties } from "react";
import { Wifi } from "lucide-react";
import { initials } from "@/lib/format";
import { businessProfile } from "@/lib/venue/business";
import { computeTheme } from "@/lib/theme";
import { safeImageUrl } from "@/lib/venue/features";
import { sourceSlug } from "@/lib/qr-source";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * A4 sheets of table cards, stickers or Wi-Fi signs in the venue's colours.
 * Used by the QR page (preview and print in place) and the standalone print
 * page. Pure rendering, so it works on the server and in the browser.
 */

const MAX_CARDS = 100;

/** What fits on one A4 sheet, per format. */
export const PRINT_FORMATS = {
  a6: { label: "A6 cards", perPage: 4, hint: "Four to a sheet. Cut along the dashed lines and slot into stands." },
  tent: { label: "Tent cards", perPage: 2, hint: "Two to a sheet. Cut along the dashed line, fold in the middle and stand it on a table or counter." },
  sticker: { label: "Round stickers", perPage: 6, hint: "Six to a sheet. Print on round sticker paper, or cut them out." },
  wifi: { label: "Wi-Fi signs", perPage: 12, hint: "Small signs for the counter and walls that point people to your QR code." },
} as const;
export type PrintFormat = keyof typeof PRINT_FORMATS;

export function isPrintFormat(value: string): value is PrintFormat {
  return value in PRINT_FORMATS;
}

/** "Menu, Wi-Fi and your stamp card": what the code opens, from what this venue offers. */
function headline(parts: string[]): string {
  if (parts.length === 0) return "Everything in one scan";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "Scan for the menu & stamp card", "Scan for our services & stamp card": the line on every card and tent. */
export function scanLine(offers: string[], food: boolean): string {
  const what = headline(offers)
    .replace(" and ", " & ")
    .replace(/^[A-Z][a-z]/, (start) => start.toLowerCase())
    .replace("your stamp card", "stamp card")
    .replace("Wi-Fi", "Wi‑Fi");
  return offers.length === 0 ? "Scan for everything in one place" : `Scan for ${food ? "the" : "our"} ${what}`;
}

/** The name round the top of a sticker: whole words only, so a long name never stops mid-word. */
export function ringName(name: string, max = 26): string {
  const upper = name.trim().toUpperCase();
  if (upper.length <= max) return upper;
  const cut = upper.slice(0, max + 1);
  const end = cut.lastIndexOf(" ");
  return (end > 0 ? cut.slice(0, end) : upper.slice(0, max)).replace(/[\s&·,\-]+$/, "");
}

/** "1-12" or "1, 2, Patio" → labelled cards ("Table 1", or "Counter 1" for a shop), capped so a typo can't render thousands. */
export function parseTables(input: string, spot = "Table"): string[] {
  const labels: string[] = [];
  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d{1,4})\s*-\s*(\d{1,4})$/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      for (let n = from; n <= to && labels.length < MAX_CARDS; n++) labels.push(`${spot} ${n}`);
    } else if (/^\d{1,4}$/.test(part)) {
      labels.push(`${spot} ${part}`);
    } else {
      labels.push(part.slice(0, 40));
    }
    if (labels.length >= MAX_CARDS) break;
  }
  return labels.slice(0, MAX_CARDS);
}

/** What the venue's codes open, for the card headlines. */
export interface PrintVenue {
  id: string;
  name: string;
  tagline: string | null;
  branding: VenueBranding;
  /** "Menu" (or "Products", "Services"…), "Wi-Fi", "your stamp card" or "member rewards", in that order. */
  offers: string[];
  /** Where codes stand, numbered on the cards: "Table" or "Counter". */
  spot: string;
  /** A food business: "Scan for the menu"; otherwise "Scan for our products". */
  food: boolean;
  /** The page shares a Wi-Fi password, so Wi-Fi signs make sense. */
  wifi: boolean;
}

/** The formats this venue can print: Wi-Fi signs only when its page shares the Wi-Fi. */
export function printFormats(venue: Pick<PrintVenue, "wifi">): PrintFormat[] {
  return (Object.keys(PRINT_FORMATS) as PrintFormat[]).filter((format) => format !== "wifi" || venue.wifi);
}

/** How many A4 sheets a format needs for these tables. */
export function sheetCount(format: PrintFormat, tables: number): number {
  return format === "wifi" ? 1 : Math.max(1, Math.ceil(tables / PRINT_FORMATS[format].perPage));
}

export function PrintSheets({ venue, labels, color, format }: { venue: PrintVenue; labels: string[]; color: string; format: PrintFormat }) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const logo = safeImageUrl(venue.branding.logoUrl);
  const theme = computeTheme(venue.branding);
  const title = scanLine(venue.offers, venue.food);
  const ring = (venue.offers.length ? venue.offers : [venue.food ? "Menu" : "Offers"])
    .map((o) => o.replace("your ", "").replace("stamp card", "rewards").replace("member rewards", "rewards").toUpperCase())
    .join(" · ");
  // The venue's own colours for the A6 cards, stickers and signs.
  const venueStyle = { ...theme.vars, background: "var(--page-bg)", color: "var(--text-primary)" } as CSSProperties;
  // The venue name round the top of a sticker shrinks to fit the arc.
  const ringTitle = ringName(venue.name);
  const ringFont = Math.min(15, Math.floor(210 / (ringTitle.length * 0.85)));
  const items = format === "wifi" ? Array.from({ length: PRINT_FORMATS.wifi.perPage }, (_, i) => `Wi-Fi ${i + 1}`) : labels;
  const perPage = PRINT_FORMATS[format].perPage;
  const pages: string[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  // An unlabelled card ("") is one of several identical copies: no spot in its code or on it.
  const qr = (label: string) => `/api/dashboard/venues/${venue.id}/qr?${new URLSearchParams({ ...(label ? { s: sourceSlug(label) } : {}), color })}`;
  const chip = (label: string) => (label ? <span className="table-chip">{label}</span> : null);

  const logoMark = (className: string) =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
      <img className={className} src={logo} alt="" />
    ) : (
      <span className={className} aria-hidden>
        {initials(venue.name)}
      </span>
    );

  const tentPanel = (label: string) => (
    <div className="tent-panel">
      <div className="tent-qr">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
        <img src={qr(label)} alt={label ? `QR code for ${label}` : "QR code"} />
      </div>
      <div className="tent-text">
        <span className="tent-venue">
          {logoMark("tent-logo")}
          {venue.name}
        </span>
        <h2>{title}</h2>
        <p>Point your phone camera at the code. No app needed.</p>
        {chip(label)}
      </div>
    </div>
  );

  return (
    <div className="print-sheets" data-style={theme.style ?? undefined}>
      {pages.map((page, pageIndex) => (
        <section key={pageIndex} className="print-page" data-format={format} aria-label={`Sheet ${pageIndex + 1}`}>
          {page.map((label, index) => {
            if (format === "tent")
              return (
                <div key={`${label}-${index}`} className="tent-card" style={venueStyle}>
                  <div className="tent-flipped">{tentPanel(label)}</div>
                  <span className="tent-fold">Fold</span>
                  {tentPanel(label)}
                </div>
              );
            if (format === "sticker")
              return (
                <div key={`${label}-${index}`} className="sticker-cell">
                  <div className="sticker" style={venueStyle}>
                    <svg className="sticker-ring" viewBox="0 0 200 200" aria-hidden>
                      <defs>
                        <path id={`top-${pageIndex}-${index}`} d="M 26 100 A 74 74 0 0 1 174 100" />
                        <path id={`bottom-${pageIndex}-${index}`} d="M 22 100 A 78 78 0 0 0 178 100" />
                      </defs>
                      <text className="sticker-name" style={{ fontSize: ringFont, letterSpacing: ringFont * 0.22 }}>
                        <textPath href={`#top-${pageIndex}-${index}`} startOffset="50%" textAnchor="middle">
                          {ringTitle}
                        </textPath>
                      </text>
                      <text className="sticker-offers">
                        <textPath href={`#bottom-${pageIndex}-${index}`} startOffset="50%" textAnchor="middle">
                          {ring}
                        </textPath>
                      </text>
                    </svg>
                    <span className="sticker-qr">
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
                      <img src={qr(label)} alt={label ? `QR code for ${label}` : "QR code"} />
                    </span>
                  </div>
                  {label && <span className="sticker-label">{label}</span>}
                </div>
              );
            if (format === "wifi")
              return (
                <div key={`${label}-${index}`} className="wifi-sign" style={venueStyle}>
                  <Wifi aria-hidden />
                  <span>
                    <strong>Wi-Fi? Scan the code</strong>
                    {venue.food ? "on your table" : "near the counter"}. Password in one tap.
                  </span>
                </div>
              );
            return (
              <div key={`${label}-${index}`} className="a6-card" style={venueStyle}>
                {logoMark("a6-logo")}
                <span className="a6-name">{venue.name}</span>
                {venue.tagline && <span className="a6-tagline">{venue.tagline}</span>}
                <span className="a6-rule" aria-hidden />
                <h2>{title}</h2>
                <span className="a6-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
                  <img src={qr(label)} alt={label ? `QR code for ${label}` : "QR code"} />
                </span>
                <span className="a6-foot">
                  {chip(label)}
                  <span>Point your phone camera · No app needed</span>
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** The bits of a venue the sheets need, from its saved config. */
export function printVenue(
  id: string,
  config: { name: string; venueType?: string | null; branding: VenueBranding; menus: unknown[]; wifi?: { ssid?: string | null } | null; loyaltyProgram?: { stampsEnabled?: boolean } | null },
): PrintVenue {
  const profile = businessProfile(config.venueType);
  return {
    id,
    name: config.name,
    tagline: config.branding.tagline ?? null,
    branding: config.branding,
    spot: profile.spot,
    food: profile.foodFields,
    wifi: !!config.wifi?.ssid,
    offers: [
      ...(config.menus.length > 0 ? [profile.catalogue] : []),
      ...(config.wifi?.ssid ? ["Wi-Fi"] : []),
      ...(config.loyaltyProgram ? [config.loyaltyProgram.stampsEnabled === false ? "member rewards" : "your stamp card"] : []),
    ],
  };
}
