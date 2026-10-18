import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails } from "@/config/legal";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "Delivery policy" };

/** Razorpay asks every merchant for a shipping/delivery policy; for an online service it says how access is delivered. */
export default async function ShippingPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/shipping" title="Delivery policy">
      <p>
        {BRAND.name} is an online software service. <strong>Nothing is shipped</strong>: there are no physical goods and no delivery charges.
      </p>

      <h2>How you get the service</h2>
      <ul>
        <li>Your account and your venue&apos;s guest page are ready the moment you finish signing up, with the free trial running.</li>
        <li>When you subscribe, the venue switches to the paid plan as soon as Razorpay confirms the payment, usually within a minute, and a confirmation is emailed to you.</li>
        <li>Your QR codes and table cards are downloaded from the dashboard and printed by you, wherever you like.</li>
        <li>The service is available across India and anywhere else with an internet connection.</li>
      </ul>

      <h2>If something doesn&apos;t arrive</h2>
      <p>
        If your venue hasn&apos;t switched to the paid plan within 24 hours of a successful payment, or an email from us hasn&apos;t reached you
        (check your spam folder), contact {legal.supportEmail} or {legal.supportPhone}. If we can&apos;t give you access, you&apos;ll get a full
        refund under our <Link href="/refunds">Cancellation &amp; refund policy</Link>.
      </p>
    </LegalPage>
  );
}
