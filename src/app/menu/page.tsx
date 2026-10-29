import { LOCALE } from "@/lib/i18n";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingError } from "@/components/landing/LandingError";
import { PausedPage } from "@/components/landing/PausedPage";
import { menuExternalUrl, safeImageUrl, sanitiseExternalUrl } from "@/lib/venue/features";
import { MenuView } from "@/components/menu/MenuView";
import { businessProfile } from "@/lib/venue/business";
import { EmbedStyle } from "@/components/EmbedStyle";
import { DemoBar } from "@/components/landing/DemoBar";
import { ThemeStyle } from "@/components/ThemeStyle";
import { BRAND } from "@/config/brand";
import { firstParam, isTeamVisit, loadPausedVenue, loadVenue, queryString, sourceParam, venueParam } from "@/server/request";
import { DEMO_VENUE_IDS } from "@/server/seed";
import "@/styles/landing.css";
import "@/styles/pages.css";

export async function generateMetadata({ searchParams }: PageProps<"/menu">): Promise<Metadata> {
  const venue = await loadVenue(venueParam(await searchParams));
  const logo = venue ? safeImageUrl(venue.branding.logoUrl) : null;
  return {
    title: { absolute: venue ? `${venue.name} ${businessProfile(venue.venueType).catalogue.toLowerCase()}` : BRAND.name },
    ...(logo ? { icons: { icon: logo, apple: logo } } : {}),
    robots: { index: false, follow: false },
  };
}

/** `/menu?i=<venue code>` — the hosted menu behind the landing page's menu card. */
export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const params = await searchParams;
  const code = venueParam(params);
  const source = sourceParam(params);
  const locale = LOCALE;

  if (!code) return <LandingError locale={locale} message="id_missing" source={source} />;
  const venue = await loadVenue(code);
  if (!venue) {
    const paused = await loadPausedVenue(code);
    if (paused) return <PausedPage locale={locale} name={paused.name} branding={paused.branding} retryHref={`/s?i=${encodeURIComponent(code)}`} />;
    return <LandingError locale={locale} message="could_not_load" source={source} failedCode={code} />;
  }

  // Only hosted menus with something on them; an external-link menu has its own site.
  const menus = venue.menus.filter((menu) => !menu.externalUrl && menu.sections.some((section) => section.items.length > 0));
  // Someone landed here (an old link, a typed URL) for a venue whose menu lives elsewhere: send them there.
  const external = sanitiseExternalUrl(menuExternalUrl(venue));
  // (Not in the editor's preview frame, which shows the draft instead.)
  if (menus.length === 0 && external && source !== "preview") redirect(external);

  return (
    <>
      <ThemeStyle branding={venue.branding} />
      <EmbedStyle embed={firstParam(params.embed)} />
      {DEMO_VENUE_IDS.includes(venue.id) && !firstParam(params.embed) && <DemoBar />}
      <MenuView venueId={venue.id} venueName={venue.name} branding={venue.branding} currencyCode={venue.currencyCode} venueType={venue.venueType} whatsapp={venue.whatsapp} menus={menus} locale={locale} source={source} backHref={`/s${queryString(params)}`} team={await isTeamVisit(venue.id)} />
    </>
  );
}
