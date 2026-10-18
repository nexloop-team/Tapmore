import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails, operatedByOther } from "@/config/legal";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "Contact us" };

/**
 * The business's contact details, as the Consumer Protection (E-Commerce)
 * Rules 2020 and the DPDP Act ask, and as Razorpay checks before activating
 * payments. A named Grievance Officer is left out for now (owner's decision,
 * 2026-10-09); add one before launch.
 */
export default async function ContactPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/contact" title="Contact us">
      <p>We&apos;re happy to help with setting up your page, billing, or anything else about {BRAND.name}.</p>

      <h2>Support</h2>
      <p>
        Email: <a href={`mailto:${legal.supportEmail}`}>{legal.supportEmail}</a>
        <br />
        Phone: <a href={`tel:${legal.supportPhone.replace(/[^\d+]/g, "")}`}>{legal.supportPhone}</a>
        <br />
        Hours: {legal.supportHours}
      </p>
      <p>Guests: for questions about your data at a venue, ask the venue, or write to us and we&apos;ll help.</p>

      <h2>Business details</h2>
      {operatedByOther(legal) && <p>{BRAND.name} is operated by:</p>}
      <p>
        {legal.entityLabel}
        {legal.registration && (
          <>
            <br />
            {legal.registration}
          </>
        )}
        <br />
        {legal.address}
        {legal.gstin && (
          <>
            <br />
            GSTIN: {legal.gstin}
          </>
        )}
      </p>

      <h2 id="complaints">Complaints</h2>
      <p>
        For a complaint about the service, billing or personal data, email{" "}
        <a href={`mailto:${legal.supportEmail}`}>{legal.supportEmail}</a>. We acknowledge every complaint within 48 hours and resolve it within
        30 days. If you&apos;re not satisfied with our answer on a personal-data complaint, you can complain to the Data Protection Board of
        India. See also our <Link href="/privacy">privacy policy</Link> and <Link href="/refunds">refund policy</Link>.
      </p>
    </LegalPage>
  );
}
