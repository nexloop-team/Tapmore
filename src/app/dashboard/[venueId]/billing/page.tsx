import type { Metadata } from "next";
import { Check, ExternalLink, Lock } from "lucide-react";
import { BrandMark } from "@/components/icons";
import { CancelSubscriptionButton, SubscribeButton } from "@/components/dashboard/BillingActions";
import { BRAND } from "@/config/brand";
import { accessBadge, BILLING_PERIOD, CHARGES_GST, formatInr, gstNote, parseDbDate, PLAN_FEATURES, PRICE_INR, PRICE_TOTAL_INR, TRIAL_DAYS, trialDaysLeft } from "@/lib/plans";
import { businessProfile, capitalise, lower } from "@/lib/venue/business";
import { loadDashboardVenue } from "@/server/dashboard";
import { billingMode } from "@/server/services/billing";
import { guestPageUrl } from "@/server/services/qr";
import { firstParam, serverOrigin } from "@/server/request";

export const metadata: Metadata = { title: "Subscription" };

const DAY = 86_400_000;

function formatDay(time: number | null): string {
  return time === null ? "" : new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

function formatDate(time: number | null): string {
  return time === null ? "" : new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

type Step = { title: string; sub: string; state: "done" | "now" | "later" };

/** One status card per state, worded as in the design. */
function statusFor(input: {
  access: "paid" | "trial" | "unpaid";
  status: string | undefined;
  provider: string | null | undefined;
  cancelling: boolean;
  wasPaid: boolean;
  trialStart: number | null;
  trialEnd: number | null;
  periodEnd: number | null;
  trialDays: number | null;
  updatedAt: number | null;
  /** The business's own words: "guests" or "customers", "menu" or "products". */
  words: { people: string; catalogue: string };
}): { badge?: string; tone: "trial" | "ok" | "danger" | "info"; title: string; body: string; steps?: Step[]; progress?: { elapsed: number; total: number; start: string; end: string } } {
  const { access, status, provider, cancelling, wasPaid, trialStart, trialEnd, periodEnd, trialDays, updatedAt, words } = input;
  if (access === "trial") {
    const lastDay = trialDays !== null && trialDays <= 1;
    const total = Math.max(1, Math.round(((trialEnd ?? 0) - (trialStart ?? 0)) / DAY));
    const elapsed = Math.min(total, Math.max(0, Math.floor((Date.now() - (trialStart ?? Date.now())) / DAY)));
    return {
      tone: "trial",
      title: lastDay ? "Your free trial ends tonight" : `Your free trial ends on ${formatDay(trialEnd)}`,
      body: lastDay
        ? "Last day of your free trial. Your page goes offline tonight unless you subscribe. Nothing is deleted: subscribe any time and it comes back exactly as it was."
        : "Your page goes offline then unless you subscribe. Nothing is deleted: subscribe any time and it comes back exactly as it was.",
      progress: total <= 31 ? { elapsed, total, start: `Started ${formatDay(trialStart)}`, end: `Ends ${formatDay(trialEnd)}` } : undefined,
    };
  }
  if (access === "unpaid") {
    return {
      badge: "Unpaid · page offline",
      tone: "danger",
      title: "Your page is offline",
      body: `${capitalise(words.people)} who scan your codes see a friendly “taking a short break” page. Your ${words.catalogue}, ${words.people} and stamp cards are all safe.`,
      steps: [
        { title: wasPaid ? "Subscription ended" : "Trial ended", sub: formatDay(wasPaid ? updatedAt : trialEnd), state: "done" },
        { title: "Subscribe", sub: "Takes about a minute with UPI", state: "now" },
        { title: "Page is back", sub: "Straight away, exactly as it was", state: "later" },
      ],
    };
  }
  if (provider === "manual") {
    return {
      badge: "Free access",
      tone: "info",
      title: `Free access from the ${BRAND.name} team`,
      body: "Everything is included and there’s nothing to pay. We’ll let you know before this ever changes.",
    };
  }
  if (status === "past_due") {
    return {
      badge: "Payment failing",
      tone: "danger",
      title: "Your renewal didn’t go through",
      body: "Razorpay will retry a few times. If every retry fails, your page goes offline until you subscribe again. Check that your card or UPI mandate is still valid.",
      steps: [
        { title: "Payment failed", sub: formatDay(updatedAt), state: "done" },
        { title: "Razorpay retries", sub: "Over the next few days", state: "now" },
        { title: "Page goes offline", sub: "Only if all retries fail", state: "later" },
      ],
    };
  }
  if (cancelling) {
    return {
      badge: "Won’t renew",
      tone: "info",
      title: `Your page stays live until ${formatDate(periodEnd)}`,
      body: `Your subscription won’t renew. Changed your mind? Subscribe again before then and nothing changes for your ${words.people}.`,
    };
  }
  return {
    tone: "ok",
    title: periodEnd ? `Renews on ${formatDate(periodEnd)}` : "You’re subscribed",
    body: `Razorpay will charge ${formatInr(PRICE_TOTAL_INR)}${CHARGES_GST ? " including GST" : ""} on that day. Your page stays live the whole time.`,
  };
}

export default async function BillingPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/billing">) {
  const { venue, subscription, access } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const mode = billingMode();
  const badge = accessBadge(subscription);
  const periodEnd = parseDbDate(subscription?.currentPeriodEnd);
  const trialEnd = parseDbDate(subscription?.trialEndsAt);
  const trialStart = trialEnd !== null ? Math.min(parseDbDate(venue.createdAt) ?? trialEnd - TRIAL_DAYS * DAY, trialEnd - DAY) : null;
  const managedBySupport = access === "paid" && subscription?.provider === "manual";
  const cancelling = access === "paid" && !!subscription?.cancelAtPeriodEnd;
  const canCancel = access === "paid" && !managedBySupport && !cancelling;
  const canSubscribe = access !== "paid" || cancelling;
  const devMode = mode === "dev" || subscription?.provider === "dev";
  const guestUrl = guestPageUrl(await serverOrigin(), venue.shortCode);
  const profile = businessProfile(venue.config.venueType);
  const words = { people: profile.people, catalogue: lower(profile.catalogue) };
  const state = statusFor({
    access,
    status: subscription?.status,
    provider: subscription?.provider,
    cancelling,
    wasPaid: !!subscription?.provider && subscription.provider !== "manual",
    trialStart,
    trialEnd,
    periodEnd,
    trialDays: trialDaysLeft(subscription),
    updatedAt: parseDbDate(subscription?.updatedAt),
    words,
  });
  const subscribeLabel = cancelling ? "Subscribe again" : access === "unpaid" ? "Subscribe now" : "Subscribe";
  const planPoints = access === "unpaid" ? ["Everything included, no add-ons", "Page back online the moment you pay", "Cancel any time before renewal"] : PLAN_FEATURES;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subscription</h1>
          <p>One plan with everything in it. Billed once a year for each business.</p>
        </div>
      </div>

      {firstParam(query.subscribed) && <div className="notice notice-ok" style={{ marginBottom: 16 }}>You’re subscribed. Thank you! Your receipt is on its way to your inbox.</div>}
      {mode === "dev" && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          Payments are in dev mode (no Razorpay keys set): subscribing switches the business on for a year without payment.
        </div>
      )}

      <div className="billing-grid">
        <div className="billing-main">
          <section className="card billing-status">
            <span className={`badge ${state.badge ? (state.tone === "danger" ? "badge-danger" : state.tone === "info" ? "badge-info" : "badge-ok") : badge.className}`}>
              <span className="badge-dot" aria-hidden />
              {state.badge ?? badge.label}
            </span>
            <h2>{state.title}</h2>
            <p>{state.body}</p>
            {state.progress && (
              <div className="trial-progress">
                <div className="trial-bars" aria-hidden>
                  {Array.from({ length: state.progress.total }, (_, i) => (
                    <span key={i} className={i < state.progress!.elapsed ? "done" : i === state.progress!.elapsed ? "now" : ""} />
                  ))}
                </div>
                <div className="trial-dates">
                  <span>{state.progress.start}</span>
                  <span>{state.progress.end}</span>
                </div>
              </div>
            )}
            {state.steps && (
              <ol className="billing-steps">
                {state.steps.map((step, i) => (
                  <li key={step.title} className={step.state}>
                    <span className="billing-step-mark" aria-hidden>
                      {step.state === "done" ? <Check /> : i + 1}
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      {step.sub && <span>{step.sub}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="inline billing-actions">
              {access === "trial" && mode !== "disabled" && <SubscribeButton venueId={venue.id} label="Subscribe" />}
              {(access === "unpaid" || access === "paid") && (
                <a className="btn" href={guestUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden /> See what {words.people} see
                </a>
              )}
              {canCancel && <CancelSubscriptionButton venueId={venue.id} endsOn={formatDate(periodEnd) || null} devMode={devMode} />}
            </div>
          </section>

          <section className="card billing-faq">
            <details open={access !== "paid"}>
              <summary>What happens if I don’t subscribe?</summary>
              <p>
                Your page goes offline when the trial ends. You can still sign in and edit everything. Subscribe any time and the page comes back exactly as it was, with your {words.catalogue},{" "}
                {words.people} and stamp cards.
              </p>
            </details>
            <details>
              <summary>{CHARGES_GST ? "Do I get a GST invoice?" : "Do I get a receipt?"}</summary>
              <p>
                {CHARGES_GST ? (
                  <>
                    Yes. Razorpay emails a receipt for every payment with the 18% GST shown. Need your GSTIN on the invoice? Email{" "}
                    <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> and we’ll add it.
                  </>
                ) : (
                  <>Yes. Razorpay emails a receipt for every payment. No GST is charged, so there&apos;s no GST to claim back.</>
                )}
              </p>
            </details>
            <details>
              <summary>Can I cancel later?</summary>
              <p>Yes, any time. Your page stays live until the end of the year you paid for, nothing is deleted, and you can subscribe again whenever you like.</p>
            </details>
          </section>
        </div>

        <aside className="plan-card">
          <div className="plan-card-head">
            <span className="plan-brand">
              <BrandMark size={26} /> {BRAND.name.toLowerCase()}
            </span>
            {access === "trial" && <span className="plan-flag">{TRIAL_DAYS} days free</span>}
          </div>
          <div className="plan-price">
            {formatInr(PRICE_INR)}
            <span> / {BILLING_PERIOD} per business</span>
          </div>
          <p className="plan-gst">
            {gstNote()}
          </p>
          <ul>
            {planPoints.map((feature) => (
              <li key={feature}>
                <Check aria-hidden /> {feature}
              </li>
            ))}
          </ul>
          {managedBySupport ? (
            <p className="plan-on">Included free for this business</p>
          ) : access === "paid" && !cancelling ? (
            <p className="plan-on">You’re on this plan</p>
          ) : canSubscribe && mode === "disabled" ? (
            <p className="plan-on">Online payments aren’t set up yet. Email {BRAND.supportEmail} and we’ll get you subscribed.</p>
          ) : (
            canSubscribe && <SubscribeButton venueId={venue.id} label={subscribeLabel} variant="light" />
          )}
          <p className="plan-secure">
            <Lock aria-hidden /> Secure checkout by Razorpay · UPI, cards, netbanking
          </p>
        </aside>
      </div>
      <p className="billing-help">
        Questions about paying? <a href={`mailto:${BRAND.supportEmail}`}>Get in touch</a>
      </p>
    </>
  );
}
