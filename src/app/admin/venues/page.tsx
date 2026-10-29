import type { Metadata } from "next";
import { Building2, Search } from "lucide-react";
import Link from "next/link";
import { AdminVenueActions } from "@/components/dashboard/AdminActions";
import { SegmentBadge } from "@/components/dashboard/admin-blocks";
import { EmptyState, PageHeader } from "@/components/dashboard/blocks";
import { VenueAvatar } from "@/components/dashboard/Shell";
import { formatAgo, formatDate } from "@/lib/format";
import { BUSINESS_GROUPS, businessProfile } from "@/lib/venue/business";
import { adminVenues, matches, VENUE_LIMIT, type VenueSegment } from "@/server/admin";
import { requireAdminPage } from "@/server/dashboard";
import { firstParam, serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";

export const metadata: Metadata = { title: "Businesses" };

const SEGMENTS: { key: VenueSegment | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paying", label: "Paying" },
  { key: "trial", label: "Trial" },
  { key: "unpaid", label: "Unpaid" },
  { key: "free", label: "Free access" },
  { key: "suspended", label: "Suspended" },
];

export default async function AdminVenuesPage({ searchParams }: PageProps<"/admin/venues">) {
  await requireAdminPage();
  const query = await searchParams;
  const q = firstParam(query.q).slice(0, 100);
  const segment = SEGMENTS.find((s) => s.key === firstParam(query.segment))?.key ?? "all";
  // Business type filter: "food", "retail", "service" or one type ("salon").
  const typeParam = firstParam(query.type);
  const typeFilter = BUSINESS_GROUPS.some((g) => g.group === typeParam || g.types.some((t) => t === typeParam)) ? typeParam : "";
  const origin = await serverOrigin();

  const all = await adminVenues();
  const ofType = (venue: (typeof all)[number]) => {
    if (!typeFilter) return true;
    const profile = businessProfile(venue.venueType);
    return profile.group === typeFilter || profile.type === typeFilter;
  };
  const searched = all.filter((venue) => ofType(venue) && matches(q, venue.name, venue.shortCode, venue.ownerEmail, venue.id));
  const rows = segment === "all" ? searched : searched.filter((venue) => venue.segment === segment);
  const countFor = (key: string) => (key === "all" ? searched.length : searched.filter((venue) => venue.segment === key).length);
  const href = (key: string) => `/admin/venues?${new URLSearchParams({ ...(q ? { q } : {}), ...(typeFilter ? { type: typeFilter } : {}), ...(key !== "all" ? { segment: key } : {}) })}`;

  return (
    <div className="page">
      <PageHeader eyebrow="Platform admin" title="Businesses" description="Search, open or suspend any business, extend a trial or give free access." />

      <section className="card card-flush">
        <div className="toolbar">
          <nav className="filter-tabs" aria-label="Filter by subscription">
            {SEGMENTS.map((s) => (
              <Link key={s.key} href={href(s.key)} aria-current={s.key === segment ? "true" : undefined}>
                {s.label} <span className="count">{countFor(s.key)}</span>
              </Link>
            ))}
          </nav>
          <form className="search" action="/admin/venues" role="search">
            {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
            <Search aria-hidden />
            <input className="input" type="search" name="q" defaultValue={q} placeholder="Name, code or owner email" aria-label="Search businesses" />
          </form>
        </div>
        <div className="toolbar">
          <nav className="filter-tabs" aria-label="Filter by type of business">
            {[{ key: "", label: "All types" }, ...BUSINESS_GROUPS.map((group) => ({ key: group.group, label: group.label }))].map((option) => (
              <Link
                key={option.key || "all"}
                href={`/admin/venues?${new URLSearchParams({ ...(q ? { q } : {}), ...(segment !== "all" ? { segment } : {}), ...(option.key ? { type: option.key } : {}) })}`}
                aria-current={option.key === typeFilter ? "true" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Building2} title={q || typeFilter ? "No businesses match that search" : "Nothing here yet"}>
            {q ? (
              <>
                Try a shorter search, or <Link href={segment === "all" ? "/admin/venues" : `/admin/venues?segment=${segment}`}>clear it</Link>.
              </>
            ) : (
              "Businesses in this group will show up here."
            )}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Type</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Subscription</th>
                  <th scope="col" className="num">
                    Guests
                  </th>
                  <th scope="col" className="num">
                    Scans · 7 days
                  </th>
                  <th scope="col">Last scan</th>
                  <th scope="col">Created</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((venue) => (
                  <tr key={venue.id}>
                    <td>
                      <Link className="cell-venue" href={`/dashboard/${venue.id}`}>
                        <VenueAvatar venue={{ name: venue.name, logoUrl: null }} />
                        <span>
                          <strong>{venue.name}</strong>
                          <span className="mono muted">/{venue.shortCode}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="nowrap">{venue.venueType ? businessProfile(venue.venueType).label : <span className="muted">Not set</span>}</td>
                    <td className="truncate">
                      {venue.ownerEmail ? (
                        <Link className="link-quiet" href={`/admin/accounts?q=${encodeURIComponent(venue.ownerEmail)}`}>
                          {venue.ownerEmail}
                        </Link>
                      ) : (
                        <span className="muted">Demo venue</span>
                      )}
                    </td>
                    <td>
                      <SegmentBadge venue={venue} />
                    </td>
                    <td className="num">{venue.guests.toLocaleString("en-IN")}</td>
                    <td className="num">{venue.scans7d.toLocaleString("en-IN")}</td>
                    <td className="nowrap">{venue.lastScanAt ? <span title={formatDate(venue.lastScanAt)}>{formatAgo(venue.lastScanAt)}</span> : <span className="muted">Never</span>}</td>
                    <td className="nowrap">
                      <span title={formatDate(venue.createdAt)}>{formatAgo(venue.createdAt)}</span>
                    </td>
                    <td className="cell-actions">
                      <AdminVenueActions
                        venueId={venue.id}
                        name={venue.name}
                        guestUrl={guestPageUrl(origin, venue.shortCode)}
                        status={venue.status}
                        segment={venue.segment}
                        renewing={venue.paying && !venue.cancelAtPeriodEnd}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          Showing {rows.length.toLocaleString("en-IN")} of {all.length.toLocaleString("en-IN")} businesses
          {all.length >= VENUE_LIMIT && ` (the ${VENUE_LIMIT} newest)`}
        </div>
      </section>
    </div>
  );
}
