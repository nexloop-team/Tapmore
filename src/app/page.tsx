import { BookOpen, Check, Heart, MessageCircle, Palette, Printer, Star, Users, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { BILLING_PERIOD, formatInr, gstNote, PLAN_FEATURES, PRICE_INR, priceSentence, TRIAL_DAYS } from "@/lib/plans";
import { isLightColor } from "@/lib/theme";
import { uiFont } from "@/app/fonts";
import { DEMO_VENUES } from "@/server/seed";
import { HeroDemo } from "@/components/HeroDemo";
import { Year } from "@/components/Year";
import { NavActions, StartLink } from "@/components/HomeLinks";
import "@/styles/app.css";

/** The share preview and install manifest belong to our own site; venues' guest pages carry none of our branding. */
export const metadata: Metadata = {
  manifest: "/brand/app.webmanifest",
  openGraph: { images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: BRAND.name }] },
  twitter: { card: "summary_large_image", images: ["/brand/og-image.png"] },
};

const DEMO_NOTES: Record<string, string> = {
  demo: "Stamp card, menu with photos, Sudoku",
  "demo-crm": "Bento tiles, Indian menu with veg marks, Wi-Fi email gate",
  "demo-rewards": "Members club, order online, colours from the logo",
  "demo-salon": "Services with “From” prices, booking link, stamp per visit",
  "demo-shop": "Featured products and offers, stamp per ₹500 spent",
};

const FEATURES = [
  { icon: BookOpen, tint: "orange", title: "Your menu or price list, always right", text: "Change a price in seconds. Photos, offers, “From” prices and today's specials included." },
  { icon: Wifi, tint: "green", title: "Wi-Fi without the questions", text: "Guests copy the password in one tap. Ask for an email first if you like." },
  { icon: Heart, tint: "rose", title: "A stamp card nobody loses", text: "Digital stamps, rewards and birthday treats. Staff stamp from any phone." },
  { icon: MessageCircle, tint: "blue", title: "Hear it first", text: "Guests tell you what went wrong in private, before it becomes a public review." },
  { icon: Star, tint: "amber", title: "More Google reviews, all answered", text: "Guests get a friendly invite to review you. Connect Google and every review gets a reply in your name." },
  { icon: Users, tint: "purple", title: "Know your regulars", text: "See who visits and how often. Export your guest list whenever you need it." },
  { icon: Printer, tint: "teal", title: "Print and you're done", text: "QR cards print at home, for tables, counters and windows. See which spots scan the most." },
  { icon: Palette, tint: "clay", title: "Looks like your place", text: `Your colour, your logo, your fonts. No ${BRAND.name} logo on your page.` },
];

const STEPS = [
  { title: "Sign up and answer four questions", text: "Your business's name and type, a colour, and a reward. Your page is live straight after." },
  { title: "Add your menu, products or services", text: "Type them in, or take a photo of your printed menu or price list and we'll read it for you." },
  { title: "Print your QR codes", text: "QR cards print on any home printer. Put one on every table or counter and you're done." },
];

const REASONS = [
  { title: "No card for the trial.", text: "Try everything for 7 days first." },
  { title: "Pay your way.", text: "UPI, cards or netbanking, through Razorpay." },
  { title: "Nothing is ever lost.", text: "If you stop paying, your page pauses and comes back exactly as it was." },
];

const FAQS = [
  {
    q: "Do my customers need to download an app?",
    a: "No. They scan the code with their phone camera and the page opens straight away. No app, no sign-up, and it loads quickly even on a slow 4G connection.",
  },
  {
    q: "What happens after the 7-day trial?",
    a: "Subscribe to keep your page live. If you don't, it pauses and guests see a friendly “back soon” page. Your menu, customers and stamp cards stay safe, and everything comes back the moment you subscribe.",
  },
  {
    q: "How do Google review replies work?",
    a: `Connect your Google Business Profile once from the dashboard. ${BRAND.name} then shows your Google reviews with a reply ready: replies to 4–5★ reviews can go out automatically, and 1–3★ ones wait for you to check. They appear on Google as the owner's response. ${BRAND.name} only reads your reviews and posts the replies you allow, and you can disconnect any time.`,
  },
  { q: "How do I pay?", a: `Through Razorpay, with UPI, a card or netbanking. It's ${priceSentence()}, for each business.` },
  {
    q: "I run two shops or cafés. Do I need two plans?",
    a: "Each business has its own page, QR codes and stamp card, and its own ₹999 yearly subscription. You manage them all from one login.",
  },
  {
    q: "Can my staff stamp cards without seeing my dashboard?",
    a: "Yes. Give them their own staff login, or pair the counter phone or tablet once. Staff can only open the till.",
  },
  {
    q: "Can I change things after I've printed my QR codes?",
    a: "Yes, anything: your menu, colours, Wi-Fi, rewards. The codes point to your page, so the same printed cards always show the latest version.",
  },
];

/** Static: the same HTML for everyone, served from the CDN; the signed-in bits are a client island (HomeLinks). */
export default function Home() {
  return (
    <div className={`app mk ${uiFont.variable}`}>
      <header className="site-nav">
        <Link className="wordmark" href="/">
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav aria-label="Main">
          <a href="#pricing">Pricing</a>
          <NavActions />
        </nav>
      </header>

      <main>
        <section className="mk-wrap hero">
          <div className="hero-copy">
            <span className="mk-eyebrow mk-pill">
              <span className="mk-dot" aria-hidden /> For cafés, shops, salons, clinics and every local business
            </span>
            <h1>One QR code for everything your customers need.</h1>
            <p className="lede">Your menu or price list, a stamp card, a private feedback box, Google reviews and the Wi-Fi, on one page that looks like your business. Set it up yourself in ten minutes.</p>
            <div className="cta">
              <StartLink className="mk-btn mk-btn-lg mk-btn-accent" />
              <a className="mk-btn mk-btn-lg mk-btn-outline" href="#demos">
                See live examples
              </a>
            </div>
            <ul className="hero-note">
              <li>
                <Check aria-hidden /> {TRIAL_DAYS}-day free trial
              </li>
              <li>
                <Check aria-hidden /> No card needed
              </li>
              <li>
                <Check aria-hidden /> {formatInr(PRICE_INR)} a year after that
              </li>
            </ul>
          </div>
          <div className="hero-visual" aria-hidden>
            <div className="phone">
              <HeroDemo />
            </div>
            <div className="hero-chip hero-chip-wifi">
              <span className="hero-chip-icon ok">
                <Check />
              </span>
              <span>
                <strong>Password copied</strong>
                No more asking at the counter
              </span>
            </div>
            <div className="hero-chip hero-chip-stamp">
              <span className="hero-chip-icon rose">
                <Heart fill="currentColor" />
              </span>
              <span>
                <strong>Stamp added · 6 of 8</strong>
                Two more for a free coffee
              </span>
            </div>
          </div>
        </section>

        <section className="mk-band">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>Everything on one page</h2>
              <p>Guests get what they came for in a tap. You get regulars, reviews and the full picture.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map(({ icon: Icon, tint, title, text }) => (
                <div key={title} className="feature">
                  <span className={`feature-icon tint-${tint}`}>
                    <Icon aria-hidden />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>Live in three steps</h2>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="step-num" aria-hidden>
                  {i + 1}
                </span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mk-band" id="pricing">
          <div className="mk-wrap pricing-split">
            <div className="pricing-copy">
              <h2>One plan. Everything included.</h2>
              <p className="lede">No tiers, no add-ons, no surprises. About ₹3 a day for each venue.</p>
              <ul className="pricing-reasons">
                {REASONS.map((reason) => (
                  <li key={reason.title}>
                    <Check aria-hidden />
                    <span>
                      <strong>{reason.title}</strong> {reason.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pricing pricing-single">
              <section className="price-card featured">
                <div className="price-top">
                  <h3>Per venue</h3>
                  <span className="price-flag">{TRIAL_DAYS} days free</span>
                </div>
                <div>
                  <div className="price">
                    {formatInr(PRICE_INR)}
                    <span> / {BILLING_PERIOD}</span>
                  </div>
                  <p className="price-gst">
                    {gstNote()}
                  </p>
                </div>
                <ul>
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden /> {feature}
                    </li>
                  ))}
                </ul>
                {/* Signed in already? /signup sends them on to their dashboard. */}
                <Link className="mk-btn mk-btn-lg mk-btn-light" href="/signup">
                  Start your free trial
                </Link>
              </section>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section" id="demos">
          <h2>Try a demo</h2>
          <p className="mk-sub">Cafés, a salon and a shop. Open one on your phone: it&apos;s exactly what your customers would see.</p>
          <div className="demo-strip">
            {DEMO_VENUES.map((venue) => {
              const bg = venue.branding.backgroundColorHex || "#FFFFFF";
              const light = isLightColor(bg);
              return (
                <a key={venue.id} className={`demo-card ${light ? "is-light" : "is-dark"}`} style={{ background: bg }} href={`/s?i=${venue.shortCode}&s=home`}>
                  {venue.branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="demo-logo" src={venue.branding.logoUrl} alt="" width={56} height={56} />
                  ) : (
                    <span className="demo-logo" />
                  )}
                  <span className="demo-name">
                    <strong>{venue.name}</strong>
                    <span>{venue.branding.tagline}</span>
                  </span>
                  <span className="demo-note">{DEMO_NOTES[venue.shortCode] ?? ""}</span>
                  <span className="demo-open">Open demo →</span>
                </a>
              );
            })}
          </div>
        </section>
        <section className="mk-band" id="faq">
          <div className="mk-wrap mk-narrow">
            <h2>Questions owners ask</h2>
            <div className="faq-list">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-cta-band">
          <h2>Your QR codes are ready when you are.</h2>
          <p>
            {TRIAL_DAYS} days free, no card needed. {formatInr(PRICE_INR)} a year after that.
          </p>
          <StartLink className="mk-btn mk-btn-lg mk-btn-light" />
        </section>
      </main>

      <footer className="site-footer">
        <div className="mk-wrap">
          <span>
            © <Year /> {BRAND.name} · Made for independent local businesses
          </span>
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/refunds">Refunds</Link>
            <Link href="/shipping">Delivery</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
