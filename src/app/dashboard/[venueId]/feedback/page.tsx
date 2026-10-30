import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { businessProfile, lower, personWord } from "@/lib/venue/business";
import { loadDashboardVenue } from "@/server/dashboard";
import { listFeedback, type FeedbackFilter } from "@/server/repositories/insights";
import { firstParam } from "@/server/request";
import { markFeedbackSeen, unreadFeedback } from "@/server/repositories/feedback";
import { FeedbackSeen } from "@/components/dashboard/FeedbackSeen";
import { afterResponse } from "@/server/after";

export const metadata: Metadata = { title: "Feedback" };

const PAGE_SIZE = 30;
const FILTERS: { key: FeedbackFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "negative", label: "Needs attention" },
  { key: "neutral", label: "Mixed" },
  { key: "positive", label: "Happy" },
];

function mood(score: number): { label: string; tone: string } {
  if (score >= 0.25) return { label: "Happy", tone: "badge-ok" };
  if (score <= -0.25) return { label: "Unhappy", tone: "badge-danger" };
  return { label: "Mixed", tone: "badge-warn" };
}

export default async function FeedbackPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/feedback">) {
  const { venue, user } = await loadDashboardVenue((await params).venueId);
  const profile = businessProfile(venue.config.venueType);
  const person = lower(personWord(profile));
  const query = await searchParams;
  const filter = (FILTERS.find((f) => f.key === firstParam(query.filter))?.key ?? "all") as FeedbackFilter;
  const page = Math.max(1, Number(firstParam(query.page)) || 1);
  const [unread, { rows, total }] = await Promise.all([unreadFeedback(venue.id, user.id), listFeedback(venue.id, { filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })]);
  // Opening the inbox reads everything in it: recorded after the page is sent, and the sidebar's count clears on screen.
  await afterResponse("mark feedback seen", () => markFeedbackSeen(venue.id, user.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/dashboard/${venue.id}/feedback`;
  const href = (f: FeedbackFilter, p = 1) => `${base}?filter=${f}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <>
      <FeedbackSeen venueId={venue.id} count={unread.count} />
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p>
            Anonymous notes from your {profile.people}, for your eyes only. Every {person} is also invited to review you on Google.
          </p>
        </div>
      </div>

      <nav className="filter-tabs" aria-label="Filter feedback" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} aria-current={f.key === filter ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card empty">
          <MessageSquareText aria-hidden />
          <p>{filter === "all" ? `No feedback yet. It shows up here the moment a ${person} sends some.` : "Nothing in this filter."}</p>
        </div>
      ) : (
        <ul className="feedback-list">
          {rows.map((item) => {
            const m = mood(item.sentiment);
            const photo = `/api/dashboard/venues/${venue.id}/feedback/${item.id}/photo`;
            return (
              <li key={item.id} className="card feedback-item">
                <div>
                  <p>{item.text}</p>
                  <div className="meta">
                    <span className={`badge ${m.tone}`}>{m.label}</span>
                    <span>{item.createdAt.slice(0, 16).replace("T", " ")} UTC</span>
                    {item.source && item.source !== "unknown" && <span>· from {item.source}</span>}
                  </div>
                </div>
                {item.hasPhoto && (
                  <a href={photo} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image */}
                    <img src={photo} alt={`Photo attached by the ${person}`} loading="lazy" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="pager">
          <span>
            {total} notes · page {page} of {pages}
          </span>
          <span className="inline">
            {page > 1 && (
              <Link className="btn btn-sm" href={href(filter, page - 1)}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="btn btn-sm" href={href(filter, page + 1)}>
                Next
              </Link>
            )}
          </span>
        </div>
      )}
    </>
  );
}
