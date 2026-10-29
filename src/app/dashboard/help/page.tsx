import type { Metadata } from "next";
import { BookOpen, ChevronRight, Gift, Mail, Printer, Receipt, Smartphone, Star, UtensilsCrossed } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/blocks";
import { BRAND } from "@/config/brand";
import { requireUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";
import { listVenuesForUser } from "@/server/repositories/venues";

export const metadata: Metadata = { title: "Help & contact" };

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need to reprint my QR codes when I change my menu or prices?",
    a: "No. Every code opens your live page, so menu, product, Wi-Fi and price changes show up the moment you save. Reprint only if you want codes for new tables or counters.",
  },
  {
    q: "A customer's phone won't scan the code. What should I check?",
    a: "Print at 100% scale (turn off “Fit to page”), keep the code dark on a light background and at least 3 cm wide, and make sure it isn't glossy under a bright light. Most phones scan straight from the camera app.",
  },
  {
    q: "How do customers join the stamp card?",
    a: "They tap the stamp card on your page and enter their email. The card lives on their phone, so there's nothing to download and nothing to lose.",
  },
  {
    q: "How do my staff add a stamp?",
    a: "The customer taps “Show to staff” on their card and your team scans it with the till phone or tablet. Add the device, or give each person a login, under Loyalty & capture → Till.",
  },
  {
    q: "What happens when my trial or subscription ends?",
    a: "Your guest page goes offline until you subscribe. Nothing is deleted: your menu, customers and stamp cards are all there when it comes back.",
  },
  {
    q: "Can I change the email I sign in with?",
    a: "Yes. Email us from the address you use now with the new one, and we'll move it over.",
  },
];

/** Help: quick routes into the right page, common questions, and a person to write to. */
export default async function HelpPage({ searchParams }: PageProps<"/dashboard/help">) {
  const user = await requireUser();
  const venues = await listVenuesForUser(user.id);
  const requested = firstParam((await searchParams).v);
  const remembered = (await cookies()).get("tt_venue")?.value;
  const venue = venues.find((v) => v.id === requested) ?? venues.find((v) => v.id === remembered) ?? (venues.length === 1 ? venues[0] : null);
  const base = venue ? `/dashboard/${venue.id}` : null;
  const subject = encodeURIComponent(`${BRAND.name} help${venue ? `: ${venue.config.name}` : ""}`);
  const mailto = `mailto:${BRAND.supportEmail}?subject=${subject}`;

  const guides = base
    ? [
        { href: `${base}/menu`, icon: UtensilsCrossed, title: "Add or update your menu or price list", text: "Type each item in one line, or import from a photo." },
        { href: `${base}/qr`, icon: Printer, title: "Print QR codes", text: "Cards, stickers and signs, numbered per table or counter." },
        { href: `${base}/loyalty`, icon: Gift, title: "Set up the stamp card", text: "Pick the reward and how many stamps it takes." },
        { href: `${base}/loyalty#till`, icon: Smartphone, title: "Add a till phone", text: "So staff can stamp cards with the camera." },
        { href: `${base}/design#google`, icon: Star, title: "Link Google reviews", text: "Happy customers get a one-tap way to review you." },
        { href: `${base}/billing`, icon: Receipt, title: "Subscription and payments", text: "Your plan, renewal date and payments." },
      ]
    : [];

  return (
    <div className="page page-narrow">
      <PageHeader title="Help & contact" description="Quick answers, and a real person when you need one." />

      <section className="card help-contact">
        <span className="help-contact-icon" aria-hidden>
          <Mail />
        </span>
        <div>
          <h2>Write to us</h2>
          <p>
            We reply within one working day. Tell us your venue name and, if something looks wrong, add a screenshot.
          </p>
          <div className="inline">
            <a className="btn btn-primary" href={mailto}>
              <Mail aria-hidden /> Email {BRAND.supportEmail}
            </a>
          </div>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="help-section" aria-labelledby="guides-title">
          <h2 id="guides-title" className="help-heading">
            Go straight to it
          </h2>
          <div className="help-guides">
            {guides.map((guide) => (
              <Link key={guide.href} className="help-guide" href={guide.href}>
                <span className="help-guide-icon" aria-hidden>
                  <guide.icon />
                </span>
                <span className="help-guide-text">
                  <strong>{guide.title}</strong>
                  <span>{guide.text}</span>
                </span>
                <ChevronRight className="help-guide-arrow" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="help-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="help-heading">
          <BookOpen aria-hidden /> Common questions
        </h2>
        <div className="card help-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
