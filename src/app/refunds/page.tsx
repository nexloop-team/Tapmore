import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails, operatedByOther } from "@/config/legal";
import { CHARGES_GST, priceSentence, TRIAL_DAYS } from "@/lib/plans";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "Cancellation & refund policy" };

/**
 * Required by Razorpay and the Consumer Protection (E-Commerce) Rules 2020.
 * The refund windows below are a business decision: change them here (and
 * the date in config/legal.ts) if the owner of the business decides otherwise.
 */
const RENEWAL_REFUND_DAYS = 7;
const REFUND_WORKING_DAYS = "5 to 7";

export default async function RefundsPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/refunds" title="Cancellation & refund policy">
      <p>
        {BRAND.name} is a yearly subscription per venue: {priceSentence()}, paid in advance through Razorpay. Payments are collected by {legal.entityName}{operatedByOther(legal) ? `, the business that operates ${BRAND.name}, so that name may appear on your bank statement and invoice.` : "."}
      </p>

      <h2>Try it free first</h2>
      <p>
        Every venue starts with a {TRIAL_DAYS}-day free trial with every feature on. No card or payment is taken, so there&apos;s nothing to
        cancel or refund if you decide not to continue.
      </p>

      <h2>Cancelling</h2>
      <ul>
        <li>Cancel any time from the venue&apos;s <strong>Subscription</strong> page in the dashboard, or by emailing {legal.supportEmail}.</li>
        <li>Cancelling stops the next renewal. Your guest page stays live until the end of the year you&apos;ve paid for, then goes offline.</li>
        <li>Your settings and guest list are kept, so you can subscribe again later and carry on where you left off.</li>
        <li>Deleting a venue or your account also cancels its subscription straight away.</li>
      </ul>

      <h2>Refunds</h2>
      <p>You&apos;ll get a full refund if:</p>
      <ul>
        <li>you were charged twice, or charged the wrong amount;</li>
        <li>you were charged after cancelling;</li>
        <li>
          a yearly <strong>renewal</strong> went through that you didn&apos;t want, and you ask within {RENEWAL_REFUND_DAYS} days of the charge
          (we cancel the subscription at the same time);
        </li>
        <li>we end your subscription without a breach of the <Link href="/terms">terms</Link> on your part (refunded for the unused months).</li>
      </ul>
      <p>
        Otherwise, because the free trial lets you try everything first, a year that has started isn&apos;t refunded when you cancel part-way
        through; your page simply stays live until the year ends. If something went wrong on our side, write to us anyway: we look at every
        case.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Email {legal.supportEmail} with the venue name and the payment date. Approved refunds are made to the original payment method
        (card, UPI or bank) through Razorpay within {REFUND_WORKING_DAYS} working days of approval; your bank may take a few more days to
        show it.{CHARGES_GST ? " GST is refunded along with the price." : ""}
      </p>

      <h2>Questions or complaints</h2>
      <p>
        See <Link href="/contact">Contact us</Link>. We acknowledge complaints within 48 hours and resolve them within 30 days.
      </p>
    </LegalPage>
  );
}
