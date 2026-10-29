import { FeedbackSummaryCard } from "@/components/dashboard/FeedbackSummaryCard";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleHelp, ExternalLink, PartyPopper, Printer, Star } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { DailyBars, PageHeader, Stat } from "@/components/dashboard/blocks";
import { DismissButton, ShowAgainButton } from "@/components/dashboard/Dismiss";
import { CopyButton } from "@/components/dashboard/ui";
import { parseDbDate } from "@/lib/plans";
import { venueUtcOffsetMinutes } from "@/lib/venue/region";
import { loadDashboardVenue } from "@/server/dashboard";
import { unreadFeedback } from "@/server/repositories/feedback";
import { listFeedback, venueEngagement, venueStats, venueTotals } from "@/server/repositories/insights";
import { firstParam, serverOrigin } from "@/server/request";
import { guestPageUrl } from "@/server/services/qr";
import { businessProfile, capitalise } from "@/lib/venue/business";

const PERIODS = [7, 30, 90] as const;
const DAY = 86_400_000;
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** A change against the previous period, as a small up/down chip. */
function Delta({ current, previous, days }: { current: number; previous: number; days: number }) {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={`delta ${change >= 0 ? "up" : "down"}`}>
        <Icon aria-hidden />
        {Math.abs(change)}%
      </span>{" "}
      vs previous {days}
    </>
  );
}

function CountDelta({ current, previous, days }: { current: number; previous: number; days: number }) {
  const change = current - previous;
  if (current === 0 && previous === 0) return null;
  return (
    <>
      <span className={`delta ${change >= 0 ? "up" : "down"}`}>
        {change >= 0 ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
        {Math.abs(change)}
      </span>{" "}
      vs previous {days}
    </>
  );
}

/** Card names on the guest page, as the owner knows them. */
const FEATURE_LABELS: Record<string, string> = { menu: "Menu", wifi: "Wi-Fi", feedback: "Feedback", google_review: "Google review", sudoku: "Sudoku", link: "Your links" };

/** 0 → "12am", 13 → "1pm". */
function hourLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;
}

/** "3 Oct" for a stored timestamp. */
function shortDate(value: string): string {
  const date = parseDbDate(value);
  return date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
}

/** Is the venue in its first week, and "Since Tuesday" for its stat tiles. */
function venueAge(createdAt: string, now = Date.now()) {
  const created = parseDbDate(createdAt) ?? now;
  return { firstWeek: now - created < 7 * DAY, sinceDay: `Since ${new Date(created).toLocaleDateString("en-IN", { weekday: "long" })}` };
}

/** "table-4" → "Table 4"; the code with no spot name is the main one. */
function spotName(source: string): string {
  if (source === "unknown") return "Main code";
  const words = source.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function VenueOverview({ params, searchParams }: PageProps<"/dashboard/[venueId]">) {
  const { venueId } = await params;
  const query = await searchParams;
  const { venue, user } = await loadDashboardVenue(venueId);
  const days = PERIODS.find((p) => String(p) === firstParam(query.days)) ?? 30;
  const config = venue.config;
  const offset = venueUtcOffsetMinutes(config.currencyCode);
  // Everything the page shows, fetched side by side. The doubled window only
  // feeds the "vs previous period" deltas, so it needs the totals alone.
  const [stats, both, unread, engagement, latest] = await Promise.all([
    venueStats(venue.id, days, offset),
    venueTotals(venue.id, days * 2, offset),
    unreadFeedback(venue.id, user.id),
    venueEngagement(venue.id, days, offset),
    listFeedback(venue.id, { limit: 3 }),
  ]);
  const latestFeedback = latest.rows;
  const url = guestPageUrl(await serverOrigin(), venue.shortCode);
  // Opened from here in preview mode, so the owner's own look doesn't count as a scan.
  const viewUrl = `${url}&s=preview`;
  // Parts of this page the owner has closed, per venue (see Dismiss).
  const hideCookie = `tt_hide_${venue.id}`;
  const hidden = new Set(((await cookies()).get(hideCookie)?.value ?? "").split(",").filter(Boolean));
  const base = `/dashboard/${venue.id}`;

  const { firstWeek, sinceDay } = venueAge(venue.createdAt);
  const googleLinked = !!config.socialLinks.google && !!config.branding.showGoogleReviewButton;
  const club = config.loyaltyProgram?.stampsEnabled === false;
  // The business's own words: "Menu" or "Products", "guests" or "customers", "table" or "counter".
  const profile = businessProfile(config.venueType);
  const People = capitalise(profile.people);
  const spot = profile.spot.toLowerCase();
  const catalogue = profile.catalogue.toLowerCase();

  const hostedItems = config.menus.reduce((sum, menu) => sum + menu.sections.reduce((n, section) => n + section.items.length, 0), 0);
  const checklist: { done: boolean; label: string; cta: string; href: string; why: string; icon?: ReactNode; help?: string }[] = [
    { done: !!config.branding.logoUrl, label: "Add your logo", cta: "Upload", href: `${base}/design#logo`, why: "It sits on your page and your printed QR cards." },
    {
      done: hostedItems > 0 || config.menus.some((menu) => !!menu.externalUrl),
      label: `Add your ${catalogue}`,
      cta: `Add your ${catalogue}`,
      href: `${base}/menu`,
      why: profile.foodFields ? "Type it in, or take a photo of your printed menu and we'll read it." : `Add your featured ${profile.items} and prices, or take a photo of your price list and we'll read it.`,
    },
    // Wi-Fi is only part of setup where people wait (cafés, salons, clinics); a shop can still add it on its page.
    ...(profile.wifi || config.wifi?.ssid
      ? [{ done: !!config.wifi?.ssid, label: "Share your Wi-Fi", cta: "Add Wi-Fi", href: `${base}/design#wifi`, why: `${People} copy the password in one tap, so nobody has to ask at the counter.` }]
      : []),
    { done: googleLinked, label: "Link your Google reviews", cta: "Add the link", href: `${base}/design#google`, why: `${People} who loved their visit can't find your review page yet. It takes a minute.`, help: `${base}/design#google` },
    {
      done: !!config.loyaltyProgram && (config.loyaltyProgram.stampsEnabled === false || !!config.loyaltyProgram.rewardName),
      label: club ? "Set up your members club" : "Set up a stamp card",
      cta: "Set up",
      href: `${base}/loyalty`,
      why: `Regular ${profile.people} collect stamps on their phone and staff add them at the till.`,
    },
    { done: stats.scans > 0 || both.scans > 0, label: "Print your QR codes and get a first scan", cta: "Print QR codes", href: `${base}/qr`, why: `One per ${spot}, so you can see which spots scan most.`, icon: <Printer aria-hidden /> },
  ];
  const done = checklist.filter((item) => item.done).length;
  const next = checklist.find((item) => !item.done) ?? null;
  // A new venue gets the whole checklist; an established one a short "what to do next".
  const setupHidden = hidden.has("setup") || done === checklist.length;
  const settingUp = !setupHidden && (done <= 3 || (firstWeek && done < checklist.length));
  const nextStep = setupHidden ? null : next;
  // Unread feedback already shows in "Latest feedback", so this box is only for the next setup step.
  const showNext = !settingUp && !!nextStep;

  const dishNames = new Map(config.menus.flatMap((menu) => menu.sections.flatMap((section) => section.items.map((item) => [item.id, item.name] as const))));
  const topDishes = engagement.dishes.map((dish) => ({ ...dish, name: dishNames.get(dish.itemId) })).filter((dish): dish is typeof dish & { name: string } => !!dish.name);
  const featureLabel = (feature: string) => (feature === "menu" ? profile.catalogue : (FEATURE_LABELS[feature] ?? (feature === "loyalty" ? (club ? "Members club" : "Stamp card") : feature)));
  const maxFeature = Math.max(1, ...engagement.features.map((f) => f.visits));
  const maxHour = Math.max(...engagement.hours);
  const peakHour = maxHour > 0 ? engagement.hours.indexOf(maxHour) : null;

  const sources = [...stats.sources].sort((a, b) => b.scans - a.scans);
  const topSources = sources.slice(0, 5);
  const others = sources.slice(5);
  const otherScans = others.reduce((sum, s) => sum + s.scans, 0);
  const maxSource = Math.max(1, ...topSources.map((s) => s.scans), otherScans);

  const byWeekday = new Array<number>(7).fill(0);
  for (const d of stats.daily) byWeekday[new Date(`${d.day}T00:00:00Z`).getUTCDay()] += d.scans;
  const busiest = stats.scans >= 10 ? WEEKDAYS[byWeekday.indexOf(Math.max(...byWeekday))] : null;

  const previous = {
    scans: both.scans - stats.scans,
    menuViews: both.menuViews - stats.menuViews,
    feedback: both.feedbackCount - stats.feedbackCount,
    stamps: both.stampsGiven - stats.stampsGiven,
    reviews: both.reviewTaps - stats.reviewTaps,
  };

  return (
    <>
      {firstParam(query.welcome) && <div className="notice notice-ok">Your page is live. Open it on your phone, then work through the checklist below.</div>}
      {firstParam(query.verified) === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks!</div>}
      {firstParam(query.verified) === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
      {firstWeek && !firstParam(query.welcome) && !hidden.has("live") && (
        <div className="live-card" data-dismissible>
          <PartyPopper aria-hidden />
          <span>
            <strong>Your page is live</strong>
            <span>
              {People} can open it now. Put a QR code on each {spot} so they find it.
            </span>
          </span>
          <DismissButton cookie={hideCookie} part="live" label="Close" />
        </div>
      )}

      <PageHeader
        title="Overview"
        description={firstWeek ? `${config.name} · your first week` : `${config.name} · last ${days} days`}
        actions={
          <nav className="segmented period-switch" aria-label="Period">
            {PERIODS.map((p) => (
              <Link key={p} href={p === 30 ? base : `${base}?days=${p}`} aria-current={p === days ? "true" : undefined}>
                {p} days
              </Link>
            ))}
          </nav>
        }
      />

      <div className="share-bar">
        <span className="share-bar-label">Your page</span>
        <div className="share-pill">
          <span className="share-pill-url">{url.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={url} label="Copy" />
        </div>
        <a className="btn btn-sm" href={viewUrl} target="_blank" rel="noreferrer">
          View page <ExternalLink aria-hidden />
        </a>
        <Link className="btn btn-sm btn-ghost" href={`${base}/qr`}>
          <Printer aria-hidden /> QR codes
        </Link>
        {hidden.has("setup") && done < checklist.length && (
          <ShowAgainButton cookie={hideCookie} part="setup">
            Setup guide · {done} of {checklist.length}
          </ShowAgainButton>
        )}
      </div>

      {settingUp ? (
        <section className="card setup-card" data-dismissible>
          <div className="setup-head">
            <h2 className="card-title">Get set up</h2>
            <span className="muted num">{`${done} of ${checklist.length} done`}</span>
            <DismissButton cookie={hideCookie} part="setup" label="Hide the setup guide" />
          </div>
          <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={done}>
            <div style={{ width: `${(done / checklist.length) * 100}%` }} />
          </div>
          {next && (
            <div className="setup-next">
              <span className="setup-next-dot" aria-hidden />
              <div>
                <span className="setup-next-label">Next</span>
                <strong>{next.label}</strong>
                <p>{next.why}</p>
                <Link className="btn btn-primary" href={next.href}>
                  {next.icon} {next.cta}
                </Link>
              </div>
            </div>
          )}
          <ul className="checklist">
            {checklist
              .filter((item) => item !== next)
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((item) => (
                <li key={item.label} className={item.done ? "done" : ""}>
                  <span className="tick" aria-hidden>
                    {item.done && <Check />}
                  </span>
                  <span className="checklist-label">{item.label}</span>
                  {item.done ? (
                    <span className="muted">Done</span>
                  ) : (
                    <Link href={item.href} aria-label={item.label}>
                      <ArrowRight aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <div className="stats">
        <Stat label="Scans" value={stats.scans} sub={firstWeek ? sinceDay : <Delta current={stats.scans} previous={previous.scans} days={days} />} />
        <Stat label={`${profile.catalogue} views`} value={stats.menuViews} sub={firstWeek ? sinceDay : <Delta current={stats.menuViews} previous={previous.menuViews} days={days} />} />
        <Stat
          label="Feedback"
          value={stats.feedbackCount}
          sub={unread.count > 0 ? `${unread.count} unread` : firstWeek ? sinceDay : <CountDelta current={stats.feedbackCount} previous={previous.feedback} days={days} />}
          href={`${base}/feedback`}
        />
        <Stat
          label="Review taps"
          value={googleLinked ? stats.reviewTaps : "—"}
          sub={googleLinked ? <CountDelta current={stats.reviewTaps} previous={previous.reviews} days={days} /> : <Link href={`${base}/design#google`}>{firstWeek ? "Link Google first" : "Link Google to count these"}</Link>}
        />
        <Stat
          label={club ? "Members" : "Stamps given"}
          value={club ? stats.totalGuests : stats.stampsGiven}
          sub={firstWeek ? sinceDay : club ? undefined : <CountDelta current={stats.stampsGiven} previous={previous.stamps} days={days} />}
        />
        <Stat label={People} value={stats.totalGuests} sub={firstWeek ? sinceDay : <CountDelta current={stats.newGuests} previous={both.newGuests - stats.newGuests} days={days} />} href={`${base}/guests`} />
      </div>

      <div className="overview-grid">
        <section className="card overview-chart">
          <div className="card-head">
            <div>
              <h2>Scans per day</h2>
              {stats.scans > 0 && (
                <p>
                  {stats.scans.toLocaleString("en-IN")} visits{busiest ? ` · busiest on ${busiest}` : ""}
                </p>
              )}
            </div>
            {stats.scans > 0 && <span className="chart-legend">Today</span>}
          </div>
          {stats.scans > 0 ? (
            <DailyBars data={stats.daily.map((d) => ({ day: d.day, value: d.scans }))} label="Scans per day" unit={["scan", "scans"]} today />
          ) : (
            <div className="chart-empty">
              <div className="chart-ghost" aria-hidden>
                {[30, 50, 40, 65, 80, 12, 8].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <p>Your chart fills in as {profile.people} scan your QR codes. Check back after the weekend.</p>
            </div>
          )}
        </section>

        <section className="card overview-side">
          <div className="card-head">
            <div>
              <h2>What {profile.people} open</h2>
              <p>Share of visits that tapped each card</p>
            </div>
          </div>
          {engagement.features.length > 0 ? (
            <ul className="source-list">
              {engagement.features.map((f) => (
                <li key={f.feature}>
                  <span className="source-row">
                    <span>{featureLabel(f.feature)}</span>
                    <span className="muted num">{stats.scans > 0 ? `${Math.min(100, Math.round((f.visits / stats.scans) * 100))}%` : f.visits}</span>
                  </span>
                  <span className="meter">
                    <span style={{ width: `${(f.visits / maxFeature) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Once {profile.people} start tapping your {catalogue}, Wi-Fi and stamp card, you&apos;ll see which they use most.</p>
          )}
        </section>
      </div>

      <div className="overview-row">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Busiest times</h2>
              <p>{peakHour !== null ? `Most visits around ${hourLabel(peakHour)}` : "Visits by hour of the day"}</p>
            </div>
          </div>
          {maxHour > 0 ? (
            <div className="hour-chart" role="img" aria-label={`Visits by hour. Busiest around ${hourLabel(peakHour ?? 0)}.`}>
              <div className="hour-bars">
                {engagement.hours.map((visits, hour) => (
                  <span key={hour} className={hour === peakHour ? "peak" : undefined} style={{ height: `${Math.max(visits ? 6 : 2, (visits / maxHour) * 100)}%` }} title={`${hourLabel(hour)}: ${visits}`} />
                ))}
              </div>
              <div className="hour-axis" aria-hidden>
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
              </div>
            </div>
          ) : (
            <p className="muted">You&apos;ll see the hours {profile.people} scan most, handy for staffing and offers.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Most viewed {profile.items}</h2>
              <p>Opened on your {catalogue}</p>
            </div>
          </div>
          {topDishes.length > 0 ? (
            <ol className="rank-list">
              {topDishes.map((dish, index) => (
                <li key={dish.itemId}>
                  <span className="rank-num">{index + 1}</span>
                  <span className="rank-name">{dish.name}</span>
                  <span className="muted num">{dish.opens}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">
              When {profile.people} tap {profile.items} on your {catalogue}, the favourites show up here.
            </p>
          )}
          <Link className="link-quiet inline sources-manage" href={`${base}/menu`}>
            Edit {catalogue} <ArrowRight aria-hidden />
          </Link>
        </section>

        <section className="card overview-sources">
          <div className="card-head">
            <div>
              <h2>Where scans came from</h2>
              <p>Visits per QR code</p>
            </div>
          </div>
          {sources.length > 0 ? (
            <ul className="source-list">
              {topSources.map((source) => (
                <li key={source.source}>
                  <span className="source-row">
                    <span>{spotName(source.source)}</span>
                    <span className="muted num">{source.scans.toLocaleString("en-IN")}</span>
                  </span>
                  <span className="meter">
                    <span style={{ width: `${(source.scans / maxSource) * 100}%` }} />
                  </span>
                </li>
              ))}
              {others.length > 0 && (
                <li>
                  <span className="source-row">
                    <span>Other codes ({others.length})</span>
                    <span className="muted num">{otherScans.toLocaleString("en-IN")}</span>
                  </span>
                  <span className="meter muted-meter">
                    <span style={{ width: `${(otherScans / maxSource) * 100}%` }} />
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <p className="muted">Nothing yet.</p>
          )}
          {sources.length <= 1 && <p className="hint">Print a numbered code for each {spot} to see which spots scan most.</p>}
          <Link className="link-quiet inline sources-manage" href={`${base}/qr`}>
            {sources.length <= 1 ? "Print QR codes" : "Manage QR codes"} <ArrowRight aria-hidden />
          </Link>
        </section>
      </div>

      <FeedbackSummaryCard venueId={venue.id} feedbackHref={`${base}/feedback`} />

      <section className="card overview-feedback">
        <div className="card-head">
          <div>
            <h2>Latest feedback</h2>
            <p>{unread.count > 0 ? `${unread.count} unread` : `What ${profile.people} told you`}</p>
          </div>
          <Link className="link-quiet inline" href={`${base}/feedback`}>
            All feedback <ArrowRight aria-hidden />
          </Link>
        </div>
        {latestFeedback.length > 0 ? (
          <ul className="feedback-mini">
            {latestFeedback.map((item) => (
              <li key={item.id}>
                <span className={`mood ${item.sentiment >= 0.25 ? "good" : item.sentiment <= -0.25 ? "bad" : "neutral"}`} aria-label={item.sentiment >= 0.25 ? "Positive" : item.sentiment <= -0.25 ? "Negative" : "Neutral"} />
                <p>{item.text}</p>
                <time className="muted" dateTime={item.createdAt}>
                  {shortDate(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No feedback yet. {People} can leave a note from your page; only you see it.</p>
        )}
      </section>

      {/* Last on the page: what to act on once you've seen the numbers. */}
      {!settingUp && showNext && (
        <section className="card next-card">
          <div className="card-head">
            <h2>What to do next</h2>
            {nextStep && (
              <span className="next-setup" data-dismissible>
                Setup {done} of {checklist.length} done
                <span className="progress small" aria-hidden>
                  <span style={{ width: `${(done / checklist.length) * 100}%` }} />
                </span>
                <DismissButton cookie={hideCookie} part="setup" label="Hide the setup guide" />
              </span>
            )}
          </div>
          <div className="next-grid">
            {nextStep && (
              <div className="next-tile">
                <span className="next-icon" aria-hidden>
                  <Star />
                </span>
                <div>
                  <strong>{nextStep.label}</strong>
                  <p>{nextStep.why}</p>
                  <span className="inline">
                    <Link className="btn btn-sm" href={nextStep.href}>
                      {nextStep.cta}
                    </Link>
                    {nextStep.help && (
                      <Link className="link-quiet inline" href={nextStep.help}>
                        <CircleHelp aria-hidden /> How do I find it?
                      </Link>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
