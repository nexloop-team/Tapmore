import { ChevronRight, Plus, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/blocks";
import { VenueAvatar } from "@/components/dashboard/Shell";
import { firstParam } from "@/server/request";
import { isAdmin, requireUser } from "@/server/auth/session";
import { accessBadge } from "@/lib/plans";
import { listStaffVenuesForUser, listVenueSummariesForUser } from "@/server/repositories/venues";

/** Lands new merchants in onboarding, single-venue merchants in their venue, and lists the rest. */
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const verified = firstParam((await searchParams).verified);
  const [venues, tills] = await Promise.all([listVenueSummariesForUser(user.id), listStaffVenuesForUser(user.id)]);
  // Admins don't need a venue of their own: no venue means the console, not the setup wizard.
  if (venues.length === 0 && tills.length === 0 && isAdmin(user)) redirect("/admin");
  if (venues.length === 0 && tills.length === 0) redirect(`/onboarding${verified ? `?verified=${encodeURIComponent(verified)}` : ""}`);
  if (venues.length === 1 && tills.length === 0) redirect(`/dashboard/${venues[0].id}${verified ? `?verified=${verified}` : ""}`);

  return (
    <div className="page page-medium">
      {verified === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {verified === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
      <PageHeader
        title={venues.length > 0 ? "Your venues" : "Your till access"}
        description={venues.length > 0 ? "Each venue has its own guest page, QR codes and subscription." : "Open the till on the phone or tablet you're using behind the counter."}
        actions={
          <Link className={`btn ${venues.length > 0 ? "btn-primary" : ""}`} href="/onboarding">
            <Plus aria-hidden /> Add a venue
          </Link>
        }
      />
      <div className="venue-list">
        {venues.map((venue) => {
          const badge = accessBadge(venue.subscription);
          return (
            <Link key={venue.id} href={`/dashboard/${venue.id}`} className="card venue-tile">
              <VenueAvatar venue={{ name: venue.name, logoUrl: venue.logoUrl }} />
              <span className="venue-tile-text">
                <strong>{venue.name}</strong>
                <span className="mono muted">/{venue.shortCode}</span>
              </span>
              <span className="inline">
                {venue.status === "suspended" ? <span className="badge badge-danger">Suspended</span> : <span className={`badge ${badge.className}`}>{badge.label}</span>}
                <ChevronRight className="venue-tile-chevron" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>

      {tills.length > 0 && (
        <section className="till-access">
          {venues.length > 0 && <h2 className="card-title">Till access</h2>}
          <div className="venue-list">
            {tills.map((venue) => (
              // A plain link, not <Link>: prefetching this URL would pair the device.
              <a key={venue.id} href={`/staff/open?v=${encodeURIComponent(venue.id)}`} className="card venue-tile">
                <VenueAvatar venue={{ name: venue.config.name, logoUrl: venue.config.branding.logoUrl ?? null }} />
                <span className="venue-tile-text">
                  <strong>{venue.config.name}</strong>
                  <span className="muted">Staff login: stamp cards and give out rewards</span>
                </span>
                <span className="btn btn-primary btn-sm">
                  <ScanLine aria-hidden /> Open the till
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
