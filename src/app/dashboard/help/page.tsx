import type { Metadata } from "next";
import { BookOpen, ChevronRight, Gift, Mail, MessageCircle, Printer, Receipt, Smartphone, Star, UserPlus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/blocks";
import { CATALOGUE_ICONS } from "@/components/catalogue-icon";
import { BRAND } from "@/config/brand";
import { businessProfile, capitalise, lower, personWord, type BusinessProfile } from "@/lib/venue/business";
import { requireUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";
import { listVenuesForUser } from "@/server/repositories/venues";
import { googleConfigured } from "@/server/services/google";

export const metadata: Metadata = { title: "Help & contact" };

/** Common questions, in the business's own words ("menu" or "products", "guests" or "customers", "table" or "counter"). */
function faqFor(profile: BusinessProfile): { q: string; a: string }[] {
  const catalogue = lower(profile.catalogue);
  const people = profile.people;
  const person = lower(personWord(profile));
  const spots = `${lower(profile.spot)}s`;
  return [
    {
      q: `Do I need to reprint my QR codes when I change my ${catalogue} or prices?`,
      a: `No. Every code opens your live page, so ${catalogue}, Wi-Fi and price changes show up the moment you save. Reprint only if you want codes for new ${spots}.`,
    },
    {
      q: `A ${person}'s phone won't scan the code. What should I check?`,
      a: "Print at 100% scale (turn off “Fit to page”), keep the code dark on a light background and at least 3 cm wide, and make sure it isn't glossy under a bright light. Most phones scan straight from the camera app.",
    },
    {
      q: `How do ${people} join the stamp card?`,
      a: "They tap the stamp card on your page and enter their email. The card lives on their phone, so there's nothing to download and nothing to lose.",
    },
    {
      q: "How do my staff add a stamp?",
      a: `The ${person} taps “Show to staff” on their card and your team scans it with the till phone or tablet. Add the device, or give each person a login, under Rewards → Till.`,
    },
    {
      q: "How does refer a friend work?",
      a: `Each member gets their own invite link to share. Their friend gets your welcome offer on their first visit, and the member gets their reward once the friend has been in. Staff give both from the till, so nobody can claim them from home. Turn it on under Rewards.`,
    },
    ...(profile.foodFields
      ? []
      : [
          {
            q: `Can ${people} message me about a ${profile.item}?`,
            a: `Yes. Add your WhatsApp number on your ${person} page (Contact & social), then turn on “Ask on WhatsApp” buttons in your ${catalogue}. Each ${profile.item} gets a button that opens a chat with it already named. It's off by default: it's meant for when you share your page online.`,
          },
        ]),
    {
      q: "What happens when my trial or subscription ends?",
      a: `Your page goes offline until you subscribe. Nothing is deleted: your ${catalogue}, ${people} and stamp cards are all there when it comes back.`,
    },
    {
      q: "Can I change the email I sign in with?",
      a: "Yes. Email us from the address you use now with the new one, and we'll move it over.",
    },
  ];
}

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
  // Without a venue picked, neutral words ("products", "customers").
  const profile = businessProfile(venue ? venue.config.venueType : "other");
  const catalogue = lower(profile.catalogue);

  const guides = base
    ? [
        {
          href: `${base}/menu`,
          icon: CATALOGUE_ICONS[profile.icon],
          title: `Add or update your ${catalogue}`,
          text: `Type each ${profile.item} in, or import them from a photo.`,
        },
        { href: `${base}/qr`, icon: Printer, title: "Print QR codes", text: `Cards, stickers and signs, one per ${lower(profile.spot)} if you like.` },
        { href: `${base}/loyalty`, icon: Gift, title: "Set up rewards", text: "A stamp card, a members club, or refer a friend." },
        { href: `${base}/loyalty`, icon: UserPlus, title: "Refer a friend", text: `${capitalise(profile.people)} share a link; friends get your welcome offer.` },
        { href: `${base}/loyalty#till`, icon: Smartphone, title: "Add a till phone", text: "So staff can stamp cards and give offers with the camera." },
        googleConfigured()
          ? { href: `${base}/reviews`, icon: Star, title: "Connect Google reviews", text: "Get more reviews, and answer every one from here." }
          : { href: `${base}/design#google`, icon: Star, title: "Link Google reviews", text: `Happy ${profile.people} get a one-tap way to review you.` },
        ...(profile.foodFields ? [] : [{ href: `${base}/menu`, icon: MessageCircle, title: "WhatsApp buttons", text: `Let ${profile.people} ask about a ${profile.item} on WhatsApp.` }]),
        { href: `${base}/billing`, icon: Receipt, title: "Subscription and payments", text: "Your plan, renewal date and payments." },
      ]
    : [];
  const faq = faqFor(profile);

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
            We reply within one working day. Tell us your business name and, if something looks wrong, add a screenshot.
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
              <Link key={guide.title} className="help-guide" href={guide.href}>
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
          {faq.map((item) => (
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
