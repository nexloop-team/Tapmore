import type { Metadata } from "next";
import { LoyaltyEditor } from "@/components/dashboard/LoyaltyEditor";
import { StaffDevices } from "@/components/dashboard/StaffDevices";
import { StaffMembers } from "@/components/dashboard/StaffMembers";
import { businessProfile } from "@/lib/venue/business";
import { isReferralOnly } from "@/lib/venue/features";
import { loadDashboardVenue } from "@/server/dashboard";
import { referralStats } from "@/server/repositories/retention";
import { getVenueSettings, listStaffMembers } from "@/server/repositories/venues";
import { listStaffDevices } from "@/server/services/staff";

export const metadata: Metadata = { title: "Rewards" };

export default async function LoyaltyPage({ params }: PageProps<"/dashboard/[venueId]/loyalty">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const program = venue.config.loyaltyProgram;
  const crm = venue.config.crm;
  const people = businessProfile(venue.config.venueType).people;
  // Independent of each other: fetched side by side.
  const [settings, referrals, devices, members] = await Promise.all([getVenueSettings(venue.id), referralStats(venue.id), listStaffDevices(venue.id), listStaffMembers(venue.id)]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rewards</h1>
          <p>Turn first visits into regulars.</p>
        </div>
      </div>
      <LoyaltyEditor
        venueType={venue.config.venueType}
        venueId={venue.id}
        initial={{ loyaltyProgram: program ?? null, crm }}
        referralStats={referrals}
        previewUrl={`/s?i=${encodeURIComponent(venue.shortCode)}&s=preview`}
        automations={settings.automations}
        feedbackStamp={settings.stampPolicy.feedbackStamp}
        till={
          <>
            <StaffDevices
              venueId={venue.id}
              devices={devices}
              cooldownMinutes={settings.stampPolicy.cooldownMinutes}
              // A stamp card, or refer-a-friend offers given at the till.
              enabled={!!program && (program.stampsEnabled !== false || isReferralOnly(venue.config))}
              people={people}
            />
            <StaffMembers venueId={venue.id} members={members} people={people} />
          </>
        }
      />
    </>
  );
}
