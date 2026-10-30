import type { Metadata } from "next";
import { DeleteVenueForm, ShortCodeForm, VenueBasicsForm } from "@/components/dashboard/SettingsForms";
import { loadDashboardVenue } from "@/server/dashboard";
import { serverOrigin } from "@/server/request";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/dashboard/[venueId]/settings">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const { name, venueType, currencyCode } = venue.config;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your business details and page address.</p>
        </div>
      </div>
      <VenueBasicsForm venueId={venue.id} initial={{ name, venueType, currencyCode }} />
      <ShortCodeForm venueId={venue.id} shortCode={venue.shortCode} origin={await serverOrigin()} />
      <DeleteVenueForm venueId={venue.id} name={name} />
    </>
  );
}
