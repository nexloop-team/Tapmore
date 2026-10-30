import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/blocks";
import { DesignEditor } from "@/components/dashboard/DesignEditor";
import { businessProfile, personWord } from "@/lib/venue/business";
import { loadDashboardVenue } from "@/server/dashboard";
import { serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

export async function generateMetadata({ params }: PageProps<"/dashboard/[venueId]/design">): Promise<Metadata> {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: `${personWord(businessProfile(venue.config.venueType))} page` };
}

export default async function DesignPage({ params }: PageProps<"/dashboard/[venueId]/design">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  const profile = businessProfile(venue.config.venueType);
  return (
    <>
      <PageHeader
        // Named as in the sidebar: "Guest page" for a café, "Customer page" for a shop.
        title={`${personWord(profile)} page`}
        description={`What ${profile.people} see when they scan.`}
        actions={
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden /> View live page
          </a>
        }
      />
      <DesignEditor venueId={venue.id} shortCode={venue.shortCode} config={venue.config} />
    </>
  );
}
