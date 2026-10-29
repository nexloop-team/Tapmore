import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { MenuEditor } from "@/components/dashboard/MenuEditor";
import { businessProfile } from "@/lib/venue/business";
import { isIndianMenu } from "@/lib/venue/region";
import { loadDashboardVenue } from "@/server/dashboard";
import { aiConfigured, aiImportLimits } from "@/server/services/ai";

export async function generateMetadata({ params }: PageProps<"/dashboard/[venueId]/menu">): Promise<Metadata> {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: businessProfile(venue.config.venueType).catalogue };
}

export default async function MenuPage({ params }: PageProps<"/dashboard/[venueId]/menu">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const ai = aiConfigured() ? "on" : "off";
  const profile = businessProfile(venue.config.venueType);
  const summary = !profile.foodFields
    ? `Your ${profile.items} and prices, or “From” and “On request” where prices vary. Mark one unavailable in a tap. Add your featured ${profile.items} and offers here; link to your website for a full catalogue.`
    : isIndianMenu(venue.config.currencyCode)
      ? "Dishes, prices and veg marks. Mark a dish sold out in a tap."
      : "Dishes, prices, allergens and dietary tags. Mark a dish sold out in a tap.";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{profile.catalogue}</h1>
          <p>{summary}</p>
        </div>
        <a className="btn" href={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden /> View {profile.catalogue.toLowerCase()}
        </a>
      </div>
      <MenuEditor
        venueId={venue.id}
        menus={venue.config.menus}
        currencyCode={venue.config.currencyCode}
        venueType={venue.config.venueType}
        whatsapp={venue.config.whatsapp}
        ai={ai}
        importLimits={aiImportLimits()}
        previewUrl={`/menu?i=${encodeURIComponent(venue.shortCode)}&s=preview`}
      />
    </>
  );
}
