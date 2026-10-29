import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails } from "@/config/legal";
import { PLAN_FEATURES, priceSentence, TRIAL_DAYS } from "@/lib/plans";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "About us" };

/**
 * Who we are and what we sell, in one page: Razorpay looks for an About page
 * next to the policies before activating payments. It speaks as Tapmore;
 * the operating company appears only in the shared fine print.
 */
export default async function AboutPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/about" title={`About ${BRAND.name}`} dated={false}>
      <p>
        {BRAND.name} gives independent local businesses (cafés, restaurants, shops, salons, clinics, gyms and more) one page that their QR
        codes open: the menu or price list, a digital loyalty card, a private feedback box, an invitation to leave a Google review and the
        Wi-Fi. Owners set it up themselves in about ten minutes, with no app for customers to download.
      </p>

      <h2>Why we built it</h2>
      <p>
        Small businesses already pay for printed menus and price lists, paper stamp cards and review cards that get lost. {BRAND.name} puts all
        of them on the customer&apos;s own phone, helps businesses hear from unhappy customers privately before they leave a bad review, and
        turns one-off visitors into regulars the business can reach again, with their permission.
      </p>

      <h2>What&apos;s included</h2>
      <ul>
        {PLAN_FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <h2>Pricing</h2>
      <p>
        One plan with everything included: <strong>{priceSentence()}</strong>, per venue. Every venue starts with a {TRIAL_DAYS}-day free trial with no card needed. See our{" "}
        <Link href="/refunds">cancellation &amp; refund policy</Link>.
      </p>

      <h2>Talk to us</h2>
      <p>
        Email <a href={`mailto:${legal.supportEmail}`}>{legal.supportEmail}</a> or call {legal.supportPhone}, {legal.supportHours}. More on our{" "}
        <Link href="/contact">contact page</Link>, or <Link href="/signup">start your free trial</Link>.
      </p>
    </LegalPage>
  );
}
