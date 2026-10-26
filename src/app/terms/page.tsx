import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails, operatedByOther } from "@/config/legal";
import { priceSentence, TRIAL_DAYS } from "@/lib/plans";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "Terms of service" };

/**
 * Terms for venue owners and their staff, written for India. A careful
 * starting point, not legal advice: have a lawyer review it before launch.
 */
export default async function TermsPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/terms" title="Terms of service">
      <p>
        These terms are an agreement between you and {legal.entityLabel}
        {legal.registration ? ` (${legal.registration})` : ""}, {legal.address}
        {operatedByOther(legal) ? `, which owns and operates ${BRAND.name}` : ""} (&ldquo;{BRAND.name}&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), for your use of {BRAND.name} as a venue owner or a member of a venue&apos;s staff
        (&ldquo;you&rdquo;). By creating an account or using the service you agree to them. If you are agreeing for a business, you confirm you
        can bind it.
      </p>

      <h2>1. The service</h2>
      <p>
        {BRAND.name} gives cafés, restaurants and bars a guest page that table QR codes open: a menu, Wi-Fi details, a digital loyalty card,
        a private feedback box and a Google review link, with a dashboard to manage them, a guest list and automatic emails. If you connect your
        Google Business Profile, {BRAND.name} reads its reviews and posts the replies you approve or have switched on, in your business&apos;s name;
        you&apos;re responsible for those replies, and can edit or remove them on Google. We may improve or change features; we won&apos;t remove a core feature you pay for during your paid year without telling you first.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 and able to enter a contract under Indian law.</li>
        <li>Give accurate details and an email address you check: we send security, billing and service messages there.</li>
        <li>Keep your password safe. You&apos;re responsible for what happens under your account and your staff logins.</li>
        <li>You must be allowed to act for every venue you add.</li>
      </ul>

      <h2>3. Plan, price and payment</h2>
      <ul>
        <li>
          There is one plan, billed per venue, once a year, in advance: <strong>{priceSentence()}</strong>. All prices are in Indian rupees.
        </li>
        <li>Each new venue gets a {TRIAL_DAYS}-day free trial. No card or payment is needed for it.</li>
        <li>
          Payments are collected through Razorpay by {legal.entityName}
          {operatedByOther(legal) ? `, the business that operates ${BRAND.name}, so that name may appear on your bank statement and invoice` : ""}. Your subscription renews automatically each year until you cancel. Renewals are charged to the
          payment method you approved, under the RBI&apos;s rules for recurring payments, including any notice before a charge.
        </li>
        <li>
          If the trial ends without a subscription, or Razorpay can&apos;t collect a renewal after its retries, the venue&apos;s guest page
          goes offline until you subscribe. Your settings, menus and guest list are kept and you can still sign in.
        </li>
        {legal.gstin && <li>A GST invoice (GSTIN {legal.gstin}) is issued for every payment and emailed to you.</li>}
        <li>We may change the price for future years with at least 30 days&apos; notice by email. It never changes a year you&apos;ve paid for.</li>
      </ul>

      <h2>4. Cancellation and refunds</h2>
      <p>
        You can cancel any time from the venue&apos;s Subscription page. Refunds follow our <Link href="/refunds">Cancellation &amp; refund
        policy</Link>.
      </p>

      <h2>5. Your content</h2>
      <p>
        You own what you add: menus, photos, text and logos. You give us permission to host and display it on your guest page, only to run
        the service. You confirm you have the right to use it and that it&apos;s accurate, including prices, allergen and veg / non-veg
        information, which you are responsible for.
      </p>

      <h2>6. Your guests&apos; personal data</h2>
      <p>
        For the personal data your guests give through your page (emails, names, birthdays, stamps, visits), <strong>you are the Data
        Fiduciary</strong> and <strong>we are your Data Processor</strong> under the Digital Personal Data Protection Act, 2023. That means:
      </p>
      <ul>
        <li>We process guest data only to run your page and the features you switch on, and only on your instructions.</li>
        <li>
          We show guests our <Link href="/privacy">privacy policy</Link> and ask for consent where it&apos;s needed; you use guest data only for
          the purposes shown to them. Send offers only to guests marked &ldquo;Subscribed&rdquo;, who confirmed by email.
        </li>
        <li>You answer guests who ask to see, correct or erase their data; the guest list lets you delete a guest, and members can delete their own card.</li>
        <li>We keep guest data secure, tell you without delay about a breach affecting it, and help you meet your duties under the Act.</li>
        <li>When you delete a venue, we erase its guest data, as set out in the privacy policy.</li>
      </ul>

      <h2>7. Acceptable use</h2>
      <ul>
        <li>No unlawful, misleading, obscene or harmful content, and no links to malware or phishing.</li>
        <li>No spam: don&apos;t email guests who haven&apos;t confirmed they want offers, and don&apos;t invite people as staff who don&apos;t work for you.</li>
        <li>No attempts to break, overload, copy or get around the limits of the service or anyone else&apos;s account.</li>
        <li>We may suspend a venue page or account that breaks these rules. Unless the law or urgency prevents it, we&apos;ll tell you why first.</li>
      </ul>

      <h2>8. Availability and support</h2>
      <p>
        We work hard to keep the service running and fix problems quickly, but it may sometimes be interrupted, for example for maintenance or
        by providers we rely on. Support is by email ({legal.supportEmail}) and phone ({legal.supportPhone}), {legal.supportHours}.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss (such as lost profit or goodwill), and our total
        liability for any claim is limited to the fees you paid us for the affected venue in the 12 months before the claim. Nothing here
        limits liability that can&apos;t be limited by law, or your rights as a consumer.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You agree to compensate us for claims by others arising from your content, your use of guest data in breach of these terms or the
        law, or your breach of these terms.
      </p>

      <h2>11. Ending the agreement</h2>
      <p>
        You can delete a venue, or your whole account, from the dashboard at any time; this ends the agreement for it. We may end it with 30
        days&apos; notice, or straight away for a serious breach. If we end it without a breach on your part, we refund the unused part of
        your paid year.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>We&apos;ll email you at least 15 days before a material change takes effect. Continuing to use the service after that means you accept it.</p>

      <h2>13. Law, disputes and grievances</h2>
      <p>
        These terms are governed by the laws of India. Before going to court, please contact us (see <Link href="/contact">Contact us</Link>);
        we acknowledge complaints within 48 hours and aim to resolve them within 30 days. The courts at{" "}
        {legal.jurisdictionCity} have exclusive jurisdiction, subject to any rights you have under consumer protection law.
      </p>
    </LegalPage>
  );
}
