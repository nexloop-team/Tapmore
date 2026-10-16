import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TillEnrollForm } from "@/components/staff/TillEnrollForm";
import { birthdayAskOn, consentAgeThreshold, hasLoyaltyProgram } from "@/lib/venue/features";
import { findVenue } from "@/server/repositories/venues";
import { currentStaffDevice } from "@/server/services/staff";

export const metadata: Metadata = { title: "Add a member" };

/** `/staff/new-member`: a paired till signs a guest up to the stamp card at the counter. */
export default async function TillNewMemberPage() {
  const device = await currentStaffDevice();
  const venue = device ? await findVenue(device.venueId) : null;
  if (!device || !venue || !hasLoyaltyProgram(venue)) {
    return (
      <section className="till-message">
        <h1>Can&apos;t add members here</h1>
        <p>{device ? "This venue has no active stamp card." : "Only the venue's paired till devices can add members."}</p>
        <Link className="staff-btn staff-btn-secondary" href="/staff">
          Back
        </Link>
      </section>
    );
  }
  return (
    <div className="staff-panel">
      <Link className="till-back" href="/staff">
        <ChevronLeft aria-hidden /> Back
      </Link>
      <h1 className="till-title">Add a member</h1>
      <TillEnrollForm asksBirthday={birthdayAskOn(venue)} adultAge={consentAgeThreshold(venue)} />
    </div>
  );
}
