import type { Metadata } from "next";
import { Download, Search, Users } from "lucide-react";
import Link from "next/link";
import { GuestDelete } from "@/components/dashboard/GuestDelete";
import { loadDashboardVenue } from "@/server/dashboard";
import { listGuests } from "@/server/repositories/insights";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Guests" };

const PAGE_SIZE = 50;

const SOURCES: Record<string, string> = { landing: "Loyalty card", feedback: "After feedback", wifi: "Wi-Fi", rewards: "Members club", till: "At the till" };

export default async function GuestsPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/guests">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const q = firstParam(query.q).slice(0, 100);
  const page = Math.max(1, Number(firstParam(query.page)) || 1);
  const { rows, total } = await listGuests(venue.id, { query: q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/dashboard/${venue.id}/guests`;
  const pageHref = (n: number) => `${base}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guests</h1>
          <p>Everyone who joined your loyalty card or left their email.</p>
          <p className="hint">Guests agreed to their card, rewards and birthday emails, not to offers. Don&apos;t use this list or its export to send promotions.</p>
        </div>
        <a className="btn" href={`/api/dashboard/venues/${venue.id}/guests/export`}>
          <Download aria-hidden /> Export CSV
        </a>
      </div>

      <section className="card">
        <form className="inline" style={{ marginBottom: 14 }} action={base}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} type="search" name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search guests" />
          <button className="btn" type="submit">
            <Search aria-hidden /> Search
          </button>
        </form>

        {rows.length === 0 ? (
          <div className="empty">
            <Users aria-hidden />
            <p>{q ? "No guests match that search." : "No guests yet. They appear here when they join your loyalty card or leave their email for Wi-Fi."}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Stamps</th>
                  <th>Birthday</th>
                  <th>Joined via</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((guest) => {
                  const displayName = guest.name || guest.firstName;
                  return (
                    <tr key={guest.id}>
                      <td>
                        {displayName && <strong style={{ display: "block" }}>{displayName}</strong>}
                        <span className={displayName ? "muted" : ""}>{guest.email}</span>
                      </td>
                      <td>{guest.stamps ?? "–"}</td>
                      <td>{guest.birthday ?? "–"}</td>
                      <td>{SOURCES[guest.captureSource ?? ""] ?? guest.captureSource ?? "–"}</td>
                      <td className="muted">{guest.createdAt.slice(0, 10)}</td>
                      <td>
                        <GuestDelete venueId={venue.id} customerId={guest.id} email={guest.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="pager">
            <span>
              {total} guests · page {page} of {pages}
            </span>
            <span className="inline">
              {page > 1 && (
                <Link className="btn btn-sm" href={pageHref(page - 1)}>
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link className="btn btn-sm" href={pageHref(page + 1)}>
                  Next
                </Link>
              )}
            </span>
          </div>
        )}
      </section>
      <p className="hint" style={{ marginTop: 12 }}>
        Only email guests marked <strong>Subscribed</strong> with offers. Others joined for their loyalty card only. If a guest asks you to delete
        their data, use the bin on their row; members can also delete their own card from its page.
      </p>
    </>
  );
}
