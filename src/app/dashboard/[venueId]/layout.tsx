import { PowerOff } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountBar } from "@/components/dashboard/AccountBar";
import { AdminEditBar } from "@/components/dashboard/AdminEditBar";
import { HashFocus } from "@/components/dashboard/HashFocus";
import { parseDbDate, trialDaysLeft } from "@/lib/plans";
import { loadDashboardVenue } from "@/server/dashboard";
import { EDIT_GRANT_MINUTES, editGrantExpiry } from "@/server/repositories/admin-actions";
import { isManagerRole } from "@/server/repositories/venues";

export async function generateMetadata({ params }: LayoutProps<"/dashboard/[venueId]">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  return { title: venue.config.name };
}

export default async function VenueLayout({ children, params }: LayoutProps<"/dashboard/[venueId]"> & { children: ReactNode }) {
  const { venueId } = await params;
  const { user, venue, role, subscription, access } = await loadDashboardVenue(venueId);
  const trialDays = trialDaysLeft(subscription);
  // Only operators reach a venue they aren't a member of (loadDashboardVenue 404s everyone else).
  const operatorView = !isManagerRole(role);

  return (
    <div className="page">
      {operatorView && <AdminEditBar venueId={venue.id} venueName={venue.config.name} editingUntil={await editGrantExpiry(user.id, venue.id)} minutes={EDIT_GRANT_MINUTES} />}
      {venue.status === "suspended" && (
        <div className="notice notice-error">This venue is suspended, so its guest page is offline. Contact support to restore it.</div>
      )}
      {access === "unpaid" && venue.status !== "suspended" && (
        <div className="notice notice-error notice-action">
          <span className="inline">
            <PowerOff aria-hidden />
            <span>
              <strong>Your guest page is offline.</strong> {subscription?.paid || subscription?.status === "canceled" ? "Your subscription has ended." : "Your free trial has ended."} Subscribe to bring it back exactly as it was.
            </span>
          </span>
          {!operatorView && (
            <Link className="btn btn-primary btn-sm" href={`/dashboard/${venue.id}/billing`}>
              Subscribe
            </Link>
          )}
        </div>
      )}
      {!operatorView && <AccountBar unverifiedEmail={user.emailVerified ? null : user.email} trialDays={trialDays} trialEnds={trialDays !== null && subscription?.trialEndsAt ? new Date(parseDbDate(subscription.trialEndsAt)!).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : null} billingHref={`/dashboard/${venue.id}/billing`} />}
      <HashFocus />
      {children}
    </div>
  );
}
