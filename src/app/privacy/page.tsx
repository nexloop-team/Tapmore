import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/config/brand";
import { legalDetails, operatedByOther } from "@/config/legal";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): the business details come from the server's settings at request time (see config/legal), so a change shows without a rebuild.
export const instant = false;

export const metadata: Metadata = { title: "Privacy policy" };

/**
 * The notice under India's Digital Personal Data Protection Act, 2023 (and
 * the DPDP Rules, 2025), for both audiences: guests using a venue's page
 * (linked from every consent line and card) and venue owners. Every period
 * and mechanism it promises exists in the code (see jobs/housekeeping.ts,
 * guest deletion, consent). Have a lawyer review it before launch.
 */
export default async function PrivacyPage() {
  await connection();
  const legal = legalDetails();
  return (
    <LegalPage path="/privacy" title="Privacy policy">
      <p>
        This policy explains what personal data {BRAND.name} handles, why, how long it&apos;s kept and the rights you have under India&apos;s
        Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;). {operatedByOther(legal) ? `${BRAND.name} is operated by ${legal.entityLabel}` : `${BRAND.name} is ${legal.entityType ?? "an Indian business"}`}, {legal.address}
        (&ldquo;{BRAND.name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
      </p>
      <p>
        It covers the guest pages that venues&apos; QR codes open, the owners&apos; dashboard and the till.
      </p>
      <p>
        <strong>Two kinds of people use {BRAND.name}:</strong> <a href="#guests">guests</a> (customers) who scan a QR code at a café, shop, salon or other local business,
        and <a href="#owners">venue owners and their staff</a>, who run those pages.
      </p>

      <h2 id="guests">Part A: Guests at a venue</h2>
      <p>
        When you scan a business&apos;s QR code, the page that opens belongs to that business (the &ldquo;venue&rdquo;). <strong>The venue is the Data Fiduciary</strong>: it decides
        what to ask you for and why. {BRAND.name} runs the page for the venue as its <strong>Data Processor</strong>, and uses your data only
        for that venue, never for itself and never for advertising.
      </p>

      <h3>What is collected, and why</h3>
      <div className="legal-scroll">
        <table className="legal-table">
          <thead>
            <tr>
              <th>When you…</th>
              <th>Data</th>
              <th>Used to</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Join the loyalty card or members&apos; club</td>
              <td>Email, the name you type, stamps, rewards, visits, and your birthday if you give it (day and month, never the year)</td>
              <td>Run your card, let staff find and stamp it, email you your card, tell you when a reward is ready, and on your birthday offer you a treat at the venue and email you a birthday wish (you can unsubscribe from it)</td>
            </tr>
            <tr>
              <td>Give your email for the Wi-Fi (if the venue asks)</td>
              <td>Email, first name, the visit</td>
              <td>Show you the Wi-Fi password and count your visits (at most one a day)</td>
            </tr>
            <tr>
              <td>Leave feedback</td>
              <td>What you write and any photo you attach</td>
              <td>
                Pass your note privately to the venue, and summarise the week&apos;s notes for it with AI. Feedback isn&apos;t linked to your name or
                email; photos are re-encoded, which removes location data
              </td>
            </tr>
            <tr>
              <td>Use the page</td>
              <td>Which buttons are tapped, which QR code was scanned (for example which table or counter), a random ID for this visit, your network address</td>
              <td>Show the venue how its page is used, and protect the service from abuse (addresses are held in memory briefly, not stored)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Consent, and taking it back</h3>
      <ul>
        <li>
          To join a venue&apos;s card you tick the &ldquo;agree to join&rdquo; box: that&apos;s your agreement to the membership and its emails (your
          card, rewards and a birthday wish). Getting on the Wi-Fi never needs it.
        </li>
        <li>Each birthday email has a one-tap unsubscribe link. Unsubscribing stops them; your card keeps working.</li>
        <li>
          You can delete your card and everything on it yourself, at any time, from the link at the bottom of your card (open it on the venue&apos;s page). That
          withdraws your consent and erases your details at that venue.
        </li>
      </ul>

      <h3>Age</h3>
      <p>
        Under the DPDP Act anyone under 18 is a child, whose data needs a parent&apos;s consent. Guests at Indian venues confirm they&apos;re 18
        or older when they join. If you&apos;re under 18, please don&apos;t join or give your email without your parent or guardian.
      </p>

      <h3>On your phone</h3>
      <p>
        We don&apos;t use advertising or tracking cookies. The page stores a few small values on your phone: which card or guest ID is yours
        at this venue (so you don&apos;t have to join again), and a random visit ID that resets after 30 minutes without use.
      </p>

      <h3>How long it&apos;s kept</h3>
      <ul>
        <li>Your details, card and visits: while the venue&apos;s account exists, until you delete your card, or until the venue deletes you on request.</li>
        <li>Page-use records: 400 days. Copies of emails sent to you: 90 days, with private links removed.</li>
        <li>When a venue deletes its account, its guests&apos; data is erased. Backups roll over within 30 days.</li>
      </ul>

      <h2 id="owners">Part B: Venue owners and staff</h2>
      <p>For your own account, <strong>{BRAND.name} is the Data Fiduciary</strong>.</p>
      <ul>
        <li>
          <strong>Account:</strong> your name, email and password (stored only as a one-way hash), and which venues you run or work at. Used to
          sign you in, run your venues and send service, security and billing emails.
        </li>
        <li>
          <strong>Billing:</strong> your subscription status and Razorpay&apos;s customer and subscription IDs. Card, UPI and bank details go to
          Razorpay directly; we never see or store them.
        </li>
        <li>
          <strong>Security:</strong> sign-in sessions (a cookie, kept 90 days from your last visit), a cookie on paired till devices, network
          addresses held in memory briefly to stop abuse, and a log of support actions our staff take on accounts.
        </li>
        <li>
          <strong>Google Business Profile (only if you connect it):</strong> when you tap Connect Google, Google gives {BRAND.name} access to
          manage your business&apos;s reviews. We keep that access (encrypted), your Business Profile&apos;s name, and the reviews and replies we
          read through it. We use them only to show your reviews in your dashboard, draft replies, and post the replies you approve or have
          switched on. Disconnecting takes the access back and deletes everything we read from Google.{" "}
          {BRAND.name}&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </li>
        <li>
          <strong>Retention:</strong> while your account exists. Deleting your account erases it, along with the venues only you own and their
          guests&apos; data. Razorpay keeps its payment records, and we keep invoices, for as long as tax law requires.
        </li>
      </ul>

      <h2>Who else handles data</h2>
      <p>We use trusted service providers, bound by contract to use the data only for us. Some are outside India, which the DPDP Act allows:</p>
      <ul>
        <li>Hosting, database and file storage (our cloud provider)</li>
        <li>Email delivery (Resend)</li>
        <li>Payments (Razorpay, for venue subscriptions only)</li>
        <li>Bot protection on sign-up (Cloudflare Turnstile)</li>
        <li>AI for owners: reading menu photos, summarising a week&apos;s feedback notes (the note text only, never who wrote it), and drafting replies to Google reviews (the review&apos;s text, stars and the reviewer&apos;s first name)</li>
        <li>Google, for venues that connect their Business Profile: reading the venue&apos;s reviews and posting its replies</li>
        {process.env.GOOGLE_NL_API_KEY && <li>Judging the tone of feedback notes (Google Cloud Natural Language; the text only, never who wrote it)</li>}
        {process.env.VERCEL && <li>Measuring how fast pages load (our cloud provider; timings and the kind of device, no cookies, nothing that identifies you)</li>}
        {process.env.SENTRY_DSN && <li>Error reports, so we can fix faults (Sentry; technical details of the fault, never guests&apos; notes or contact details)</li>}
      </ul>
      <p>We don&apos;t sell personal data or share it for advertising. We disclose it to authorities only when the law requires.</p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, passwords and private links are stored hashed, Google access is stored encrypted, access is limited to people who need it, and admin actions
        are logged. If a breach affects your data, we&apos;ll tell you and the Data Protection Board of India as the DPDP Act requires.
      </p>

      <h2>Your rights</h2>
      <p>Under the DPDP Act you can:</p>
      <ul>
        <li>ask what personal data is held about you and how it&apos;s used, and who it&apos;s been shared with;</li>
        <li>have it corrected, completed, updated or erased;</li>
        <li>withdraw consent at any time (as easily as you gave it);</li>
        <li>nominate someone to act for you if you die or can&apos;t act yourself;</li>
        <li>have a complaint dealt with by us, and then, if you&apos;re not satisfied, complain to the Data Protection Board of India.</li>
      </ul>
      <p>
        Guests can ask the venue directly, or write to us and we&apos;ll pass it on and help. Owners can change most things in the dashboard or
        delete their account there. We reply within 30 days.
      </p>

      <h2 id="complaints">Questions and complaints</h2>
      <p>
        Email <a href={`mailto:${legal.supportEmail}`}>{legal.supportEmail}</a>. We acknowledge complaints within 48 hours and resolve them
        within 30 days. See also <Link href="/contact">Contact us</Link>.
      </p>
      {legal.grievanceOfficer && (
        <p>
          Our Grievance Officer is {legal.grievanceOfficer.name} (
          <a href={`mailto:${legal.grievanceOfficer.email}`}>{legal.grievanceOfficer.email}</a>), who also answers questions about how we
          handle personal data.
        </p>
      )}

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll update the date above and, for owners, email you first. Guests will see the
        new version linked from the page.
      </p>
    </LegalPage>
  );
}
