import type { ReactNode } from "react";
import { coverImages, resolvedTagline, resolvedTitle, safeImageUrl } from "@/lib/venue/features";
import type { VenueBranding } from "@/lib/venue/types";
import { CoverSlides } from "./CoverSlides";

/**
 * The venue's cover, logo, name and tagline: the top of the guest page and
 * the hosted menu. `overlay` sits on top of the cover (the menu's back link).
 */
export function VenueHeader({
  branding,
  name,
  tagline = true,
  overlay,
  poster = false,
}: {
  branding: VenueBranding;
  name: string;
  tagline?: boolean;
  overlay?: ReactNode;
  /** Guest page: the name big and bold over the cover, like a poster, arranged by the header style. */
  poster?: boolean;
}) {
  const covers = coverImages(branding);
  const cover = covers.length > 0;
  // "No logo" in the header style hides it in both headers (it still marks the browser tab and printed cards).
  const logo = branding.headerStyle === "minimal" ? null : safeImageUrl(branding.logoUrl);
  const title = resolvedTitle(branding, name);
  const line = tagline ? resolvedTagline(branding) : null;

  if (poster) {
    const arrangement = branding.headerStyle ?? "cover";
    const showLogo = !!logo && arrangement !== "minimal";
    return (
      <header className={`venue-header poster poster-align-${arrangement}${cover ? "" : " no-cover"}${showLogo ? " has-logo" : ""}`}>
        {cover && (
          <div className="poster-cover">
            <CoverSlides images={covers} />
          </div>
        )}
        {overlay}
        <div className="poster-text">
          {showLogo && (
            <div className="poster-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
              <img src={logo} alt="" />
            </div>
          )}
          <div className="poster-words">
            {line && <p className="poster-tagline">{line}</p>}
            {title && <h1>{title}</h1>}
          </div>
        </div>
      </header>
    );
  }
  const showRow = !!(logo || title || line);
  const rowClass = ["header-row", logo ? "" : "no-logo", cover ? "" : "no-cover"].filter(Boolean).join(" ");

  return (
    <header className="venue-header">
      {cover && (
        <div className="cover">
          <CoverSlides images={covers} />
        </div>
      )}
      {overlay}
      {showRow && (
        <div className={rowClass}>
          {logo && (
            <div className={`logo-circle${cover ? "" : " no-cover"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
              <img src={logo} alt="" />
            </div>
          )}
          {(title || line) && (
            <div className="header-text">
              {title && <h1>{title}</h1>}
              {line && <p className="tagline">{line}</p>}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
