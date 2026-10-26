import type { Metadata } from "next";
import { Star } from "lucide-react";
import Link from "next/link";
import { LocationPicker, ReviewCard, ReviewSettingsForm, ReviewsToolbar, type ReviewView } from "@/components/dashboard/GoogleReviews";
import { venueTimeZone } from "@/lib/venue/region";
import { loadDashboardVenue } from "@/server/dashboard";
import { ServiceError } from "@/server/http";
import { getConnection, listStoredReviews, type ReviewFilter, type StoredReview } from "@/server/repositories/google-reviews";
import { getVenueSettings } from "@/server/repositories/venues";
import { firstParam } from "@/server/request";
import { googleConfigured } from "@/server/services/google";
import { locationChoices, type LocationChoice } from "@/server/services/reviews";

export const metadata: Metadata = { title: "Google reviews" };

const PAGE_SIZE = 20;
const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "awaiting", label: "Needs reply" },
  { key: "all", label: "All" },
  { key: "replied", label: "Replied" },
];

function ConnectButton({ venueId, label = "Connect Google" }: { venueId: string; label?: string }) {
  // A plain link: prefetching it would start the Google sign-in.
  return (
    <a className="btn btn-primary" href={`/api/google/connect?venue=${encodeURIComponent(venueId)}`}>
      {label}
    </a>
  );
}

export default async function ReviewsPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/reviews">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const zone = venueTimeZone(venue.config.currencyCode);
  const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: zone, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const moment = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: zone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const google = firstParam(query.google);
  const reason = firstParam(query.reason).slice(0, 200);
  const notice =
    google === "connected"
      ? { ok: true, text: "Google is connected." }
      : google === "cancelled"
        ? { ok: false, text: "Google wasn't connected: the sign-in was cancelled." }
        : google === "error"
          ? { ok: false, text: reason || "Google couldn't be connected. Please try again." }
          : null;

  const head = (
    <div className="page-head">
      <div>
        <h1>Google reviews</h1>
        <p>Every new Google review lands here with a reply ready. Replies show on Google as the owner&apos;s response.</p>
      </div>
    </div>
  );
  const banner = notice && <div className={`notice ${notice.ok ? "notice-ok" : "notice-error"}`} style={{ marginBottom: 14 }}>{notice.text}</div>;

  if (!googleConfigured()) {
    return (
      <>
        {head}
        <div className="card empty">
          <Star aria-hidden />
          <p>Google review replies aren&apos;t switched on for this server yet.</p>
        </div>
      </>
    );
  }

  const connection = await getConnection(venue.id);

  if (!connection) {
    return (
      <>
        {head}
        {banner}
        <section className="card review-connect">
          <h2>Answer every Google review from here</h2>
          <ul>
            <li>New reviews arrive within minutes of being posted.</li>
            <li>4–5★: a reply in your café&apos;s name goes on Google automatically. You can switch this off.</li>
            <li>1–3★: a reply is drafted and waits for you to check it. You can have these posted automatically too.</li>
            <li>Reviews from before you connect are never answered automatically.</li>
          </ul>
          <p className="hint">Sign in with the Google account that owns or manages your café&apos;s Google Business Profile. You can disconnect any time.</p>
          <ConnectButton venueId={venue.id} />
        </section>
      </>
    );
  }

  if (connection.status === "revoked") {
    return (
      <>
        {head}
        {banner}
        <section className="card review-connect">
          <h2>Reconnect Google</h2>
          <p>Tapmore can no longer read or reply to your Google reviews. This happens when the Google account&apos;s access is removed or its password changes.</p>
          <ConnectButton venueId={venue.id} label="Reconnect Google" />
        </section>
      </>
    );
  }

  if (connection.status === "choose_location") {
    let choices: LocationChoice[] = [];
    let problem: string | null = null;
    try {
      choices = await locationChoices(venue.id);
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      problem = error.message;
    }
    return (
      <>
        {head}
        {banner}
        {choices.length > 0 ? (
          <LocationPicker venueId={venue.id} choices={choices} />
        ) : (
          <section className="card review-connect">
            <h2>No Business Profile on that Google account</h2>
            <p>{problem ?? "The Google account you connected doesn't own or manage a Google Business Profile. Connect the account that manages your café's profile."}</p>
            <ConnectButton venueId={venue.id} label="Connect a different account" />
          </section>
        )}
      </>
    );
  }

  const filter = FILTERS.find((f) => f.key === firstParam(query.filter))?.key ?? "awaiting";
  const page = Math.max(1, Number(firstParam(query.page)) || 1);
  const [{ rows, total }, settings] = await Promise.all([listStoredReviews(venue.id, filter, PAGE_SIZE, (page - 1) * PAGE_SIZE), getVenueSettings(venue.id)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/dashboard/${venue.id}/reviews`;
  const href = (f: ReviewFilter, p = 1) => `${base}?filter=${f}${p > 1 ? `&page=${p}` : ""}`;
  const view = (review: StoredReview): ReviewView => ({
    id: review.id,
    reviewerName: review.reviewerName,
    stars: review.stars,
    comment: review.comment,
    dateLabel: day(review.reviewTime),
    replyText: review.replyText,
    replyDateLabel: review.replyTime ? day(review.replyTime) : null,
    state: review.state,
    draftText: review.draftText,
    postedAutomatically: review.postedBy === "auto",
  });

  return (
    <>
      {head}
      {banner}
      <div className="review-top">
        <ReviewsToolbar venueId={venue.id} title={connection.locationTitle ?? "Your Business Profile"} lastSynced={connection.lastSyncedAt ? moment(connection.lastSyncedAt) : null} />
        <ReviewSettingsForm venueId={venue.id} initial={settings.reviews} />
      </div>

      <nav className="filter-tabs" aria-label="Filter reviews" style={{ margin: "18px 0 14px" }}>
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} aria-current={f.key === filter ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card empty">
          <Star aria-hidden />
          <p>{filter === "awaiting" ? "Nothing waiting for a reply." : filter === "replied" ? "No replies yet." : "No Google reviews yet. They show up here as soon as guests post them."}</p>
        </div>
      ) : (
        <ul className="review-list">
          {rows.map((review) => (
            <ReviewCard key={review.id} venueId={venue.id} review={view(review)} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="pager">
          <span>
            {total} reviews · page {page} of {pages}
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
