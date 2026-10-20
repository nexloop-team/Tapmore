# Tapmore roadmap

The working plan for Tapmore: what's done, what's next, why things were decided, and a log of every change.

**How to use this file**

- Tick a box (`- [x]`) when something is done, and add a line to the [Change log](#change-log).
- New idea? Put it in [Ideas parking lot](#ideas-parking-lot) first and move it into a section once you decide to do it.
- Changing a big decision (market, price, hosting)? Add it to the [Decisions](#decisions) table with the reason.

_Last updated: 2026-10-09_

---

## Where things stand

**Built**
- Guest page: menu, Wi-Fi, loyalty card, feedback, Google review link, Sudoku. Three demo venues.
- Self-serve owner side: signup/login, email verification, password reset, 4-step onboarding, dashboard (overview, guest page editor, menu editor, loyalty, guests, feedback, QR codes and print sheet, billing, settings), account deletion.
- One yearly plan per venue (₹999; no GST until GST-registered), 7-day free trial, Razorpay billing (dev mode without keys); unpaid venues go offline.
- Admin panel (`/admin`) for suspending venues, giving free access and revenue.
- India: PostgreSQL (Supabase), prices in ₹, venue time zones (IST by default), English-only guest pages, and the legal pages Razorpay and Indian law ask for (terms, DPDP privacy policy, refunds, delivery, contact).

- Staff stamping at the till, refer-a-friend, automatic guest emails, weekly owner digest.
- AI menu import and "What's this dish?" explanations; announcement banner; specials and badges on the menu.

**Not done yet**
- Not deployed.
- Business details for the legal pages, and a lawyer's review of them.
- No paying customers.

---

## 1. Before the first customer: product fixes

These are must-haves. Without them the product is not ready to demo or sell.

- [x] **Staff stamp & redeem mode:** paired till devices scan the guest's card QR (or search by name/email), add stamps, redeem rewards, undo; with a cooldown against double stamping.
- [x] **Follow Google's review rules:** every guest is offered the Google review after feedback; copy updated.
- [x] **Monday summary email** for owners (scans, guests, stamps, rewards, feedback), with an on/off switch per venue.
- [ ] Instant email when unhappy feedback arrives (deferred by decision on 2026-10-04).
- [x] **Captcha on signup** (Cloudflare Turnstile). Off until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are set.
- [x] **Pin the Node version** (`>=22.5`).
- [x] **Commit all code to git** (branch `redesign-and-customisation`; not pushed yet).
- [x] **Security patch:** Next.js 16.3.8 (September 2026 security release).

---

## 2. Launch setup: business and operations

> Free pilot with 20–30 cafés first, then the paid launch: [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

- [ ] Decide the brand name and buy the domain (`.com` or `.co.uk`).
- [ ] Set up a professional email address (Google Workspace or similar) and a UK virtual phone number.
- [ ] **Deploy on Railway** (or Render, Fly.io or a VPS):
  - [ ] Connect the GitHub repo.
  - [ ] Add a volume mounted at `/data` and set `DATA_DIR=/data`.
  - [ ] Set `APP_URL` to the final domain. It's printed into every QR code, so **never change it afterwards**.
  - [ ] Set `ADMIN_EMAILS` to your own email.
  - [ ] Point your domain's DNS at Railway.
- [ ] **Email:** create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and `MAIL_FROM`.
- [ ] **Payments:**
  - [x] Razorpay Subscriptions (India, rupees).
  - [ ] Create the yearly plan (₹999; ₹1,178.82 once GST is charged) and API keys.
  - [ ] Add the webhook at `/api/billing/webhook` for `subscription.*` events.
  - [ ] Activate Razorpay as a partnership firm: firm PAN, partnership deed, firm bank account, Udyam certificate (instead of GST) plus one more business proof. Ask Razorpay whether a notarised (unregistered) deed is accepted.
  - [ ] Once turnover nears ₹20 lakh a year: register for GST, set `GSTIN`, switch `CHARGES_GST` on, update the Razorpay plan.
  - [ ] Test the whole flow in test mode first.
- [ ] **Backups** of `/data`, using Railway volume snapshots or Litestream. Test restoring once.
- [ ] **Monitoring** (the code is in; these are the accounts): create a Sentry project and set `SENTRY_DSN`; turn on Speed Insights in the Vercel project; add an uptime check (e.g. UptimeRobot).
- [ ] **Legal (India):**
  - [x] Terms, privacy policy (DPDP Act 2023), cancellation & refunds, delivery policy and contact page.
  - [ ] Name a Grievance Officer on the contact and privacy pages (left out for now; Indian e-commerce and data rules expect one).
  - [x] Guests can delete their own card; owners can delete a guest on request.
  - [x] Business details set: Tapmore, a partnership firm, Nashik office (`.env.local`).
  - [ ] Sign the partnership deed, get the firm's PAN, a current account and a Udyam certificate; consider registering the firm with the Registrar of Firms (an unregistered firm can't sue a customer for unpaid dues, Indian Partnership Act s.69).
  - [ ] Give Tapmore its own support address (`NEXT_PUBLIC_SUPPORT_EMAIL`) once the domain exists.
  - [ ] Register for GST before charging it, and set `GSTIN`.
  - [ ] Confirm the refund windows in `src/app/refunds/page.tsx`.
  - [ ] Get a lawyer to review all five pages (especially guests under 18, see Decisions).
- [x] Set the price: ₹999 + GST a year per venue (`src/lib/plans.ts`).

---

## 3. Getting customers (UK first)

- [ ] Pick the first city (suggested: Manchester, Bristol, Leeds or Brighton).
- [ ] Build a list of about 300 cafés from Google Maps, with review counts, Instagram and email.
- [ ] Write the scripts: Instagram DM, cold email, follow-up, and a 2-minute Loom demo.
- [ ] Outreach routine: 20–30 personalised messages a day, each with a demo page built for that café.
- [ ] Launch offer: free setup plus 3 months half price for the first 20 cafés, in return for a testimonial.
- [ ] Approach 3–5 partners (coffee roasters, equipment suppliers, POS resellers) with 20–30% recurring commission.
- [ ] **Goal: 10 paying cafés within 60 days.**
- [ ] Write 2 case studies from real numbers (scans, reviews, members).

---

## 4. Next: features that win deals

- [x] **AI menu import:** photo or PDF, then draft sections, with AI-suggested allergens flagged for the owner to check. Needs `ANTHROPIC_API_KEY`.
- [x] **"What's this dish?":** ⓘ button on unusual dishes; AI drafts, the owner approves.
- [x] **Automatic guest emails:** "your reward is ready", birthday treat, "we miss you" (marketing ones only to opted-in guests, with one-click unsubscribe).
- [x] **Announcement banner** (specials, events), with an optional end date.
- [ ] Opening hours, address and phone card (deferred by decision on 2026-10-04).
- [x] **Easier-to-read menu:** Popular / New / Spicy / Chef's pick badges, "Today's specials" strip, bigger text, photos first on phones.

## 5. Later: once you have customers

- [x] Staff logins (stamping only, no access to billing or guest data).
- [ ] Printable menu PDF generated from the same menu data.
- [ ] Automatic menu translation for tourists.
- [ ] Import name, logo, hours and review link from the Google Business Profile at signup.
- [x] Refer-a-friend: invite link on the member's card, welcome stamps for the friend, and bonus stamps for the inviter after the friend's first real visit (max 5 a month).
- [ ] Simple email campaigns to opted-in guests.
- [ ] Custom domains per café (e.g. `menu.cafename.com`).
- [ ] Annual billing (2 months free).

---

## 6. New markets

**US** (after about 10 UK testimonials)
- [ ] Pricing in $ (suggested $29/month).
- [ ] US allergen list (the 9 major allergens) alongside the UK's 14.
- [ ] Yelp link alongside Google reviews.
- [ ] Listing on the Square App Marketplace / Toast integrations.
- [ ] Sales tax handling (Paddle or Stripe Tax).

**India** (only if selling in person)
- [ ] WhatsApp messages instead of email for guests (WhatsApp Business API).
- [ ] Razorpay with UPI Autopay.
- [ ] ₹ pricing (suggested ₹999 + 18% GST) and GST invoices.
- [ ] Hindi and regional languages on the guest page.

**Europe**
- [ ] Translations (NL, DE, ES, FR).
- [ ] € pricing.
- [ ] Stricter cold-email rules (Germany needs consent first).

---

## 7. When to upgrade the tech

Do these when there's a reason, not before.

| Trigger | Change |
|---|---|
| More than one server, or wanting Vercel | Rate limiting to Redis (Upstash); jobs from `POST /api/cron/run` with `DISABLE_JOBS=1` (Postgres and S3-compatible storage are already in place) |
| Emails over 3,000/month or 100/day | Resend Pro ($20/month) |
| Cafés asking for staff accounts | Roles in `venue_members` (the table already has a `role` column) |

---

## 8. Numbers to watch

| Metric | What it tells you | Target |
|---|---|---|
| Paying cafés and monthly revenue | Is the business growing? | 10 in 60 days, 55 to replace about ₹1 lakh/month |
| Activation: first scan within 7 days of signup | Is onboarding working? | 70% or more |
| Trial → paid conversion | Is Pro worth paying for? | 25% or more |
| Monthly cancellations (churn) | Are customers happy? | Under 3% |
| Scans per café per week | Are guests actually using it? | Rising each month |

---

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | SQLite on one server, not Postgres on Vercel | Simpler and cheaper to start; no external database to set up; easy to move later |
| 2026-10-01 | Own login code (scrypt and database sessions), not an auth service | No extra cost or dependency; fully tested |
| 2026-10-01 | Billing per venue, Free and Pro plans, 14-day Pro trial with no card | Matches how cafés think ("per shop") and lowers the barrier to trying it |
| 2026-10-02 | UK first at £19/month, then US at $29, India at ₹999 + GST only with WhatsApp | The UK pays about 2.5 times more per café and the product already fits it |
| 2026-10-07 | Owner layout: presets plus per-card controls, no page builder | Keeps every guest page fast and readable on any colour; café owners want a few good choices, not a blank canvas |
| 2026-10-07 | Hide/rename/reorder cards and the new menu look on every plan; layout presets, header styles and button shapes Pro only | Basic control shouldn't be paywalled; layouts are a visible reason to upgrade |
| 2026-10-08 | One plan, ₹999 + GST a year, 7-day trial; Razorpay; unpaid venues go offline (replaces the UK/Free-Pro rows above) | Selling in India first |
| 2026-10-09 | Guest pages in English only (Spanish removed) | India first; half the Spanish strings were missing |
| 2026-10-09 | A returning member is emailed their card, not shown it | Anyone can type an email, and the card's QR code is what staff redeem rewards from |
| 2026-10-09 | Indian venues ask guests to confirm 18+ before agreeing to offers | Under the DPDP Act everyone under 18 is a child; a lawyer should confirm whether joining a card needs the same |

---

## Ideas parking lot

Ideas not yet decided. Move them into a section above when you commit to them.

- Tap-to-stamp NFC stickers at the till
- Track real Google reviews: a daily rating and review-count snapshot (Places API), or full reviews with replies (Business Profile API). Skipped for now (2026-10-10); the overview counts taps on the review button.
- "Order at table" / pay at table
- Table-specific QR codes that call staff ("Request the bill")
- Integration with POS systems (Square, Toast, Petpooja) to stamp automatically on payment

---

## Change log

Newest first. One line per change: what changed and why.

**Template**

```
### YYYY-MM-DD
- Added / Changed / Fixed: what, and why
```

### 2026-10-18: offline till, cached guest pages
- Added (till): a stamp, reward or undo made with no connection is kept on the till ("Offline · 1 waiting") and sent when it's back, within 2 minutes; older ones are dropped with "Not sent: … Scan their card again" (kept until dismissed). Every till action carries a request id the server remembers (`stamp_events.request_id`), so a resend never stamps twice. The Online/Offline badge also notices Wi-Fi with no internet behind it (`experimental.useOffline`).
- Added: a service worker for the dashboard and the till only (`/sw.js`, never on guest pages): app files load from the device after the first visit, a page that can't load shows "You're offline" (`/offline`), and a new deploy shows "A new version is ready · Reload" instead of changing code under a till mid-stamp. It never stores pages or API answers. Theme colour and "add to home screen" settings for both.
- Faster: Cache Components is on. Guest pages, the card link and the dashboard send a prebuilt shell (their loading placeholder) at once and stream the rest; the home page and sign-in frame are static. Routes that need the signed-in user, the till device or the server's settings before showing anything keep a commented `instant = false` (dashboard, till and admin layouts, onboarding, email-link pages, legal pages).
- Faster: the guest page's venue lookup is cached across requests and servers (`"use cache: remote"`; Vercel's runtime cache, or memory when self-hosted): repeat scans make no database queries. Every write to a venue or its subscription ends the cached copy at once (`server/venue-cache.ts`), so saves, suspensions, billing changes and new addresses show on the next scan; whether a page is live is still worked out per request, so a trial ending is noticed on time.
- Changed: the React Compiler memoises the big dashboard editors (annotation mode, `"use memo"`); compiling every component cost the guest pages 6-13 KB. Partial Prefetching was tried and left off: no faster on 4G here, and it rendered the dashboard layout twice per page load.
- Changed: the demo bar's links prefetch the home and sign-up pages when a finger or pointer reaches them, not on sight (they have prebuilt shells, so a prefetch fetches their styles and fonts too). Footer years are read in the browser, so a static page shows the current year.
- Added: monitoring. Vercel Speed Insights reports real-world loading, responsiveness and layout shift (turn it on in the Vercel project; about 2 KB on the page, route shapes only: never the address, whose card tokens and query strings stay private). Sentry error reports and traces on the server only, when `SENTRY_DSN` is set (query strings, cookies, headers and request bodies stripped from errors and traces; checked against a mock collector). Every API response carries `Server-Timing` (database time, query count, total). The privacy policy lists both providers while they're on.
- Fixed (docs): `.env.example` recommended Supabase's Session pooler; on Vercel it's the Transaction pooler (port 6543), as the README says.
- Dev note: `next build` locally sometimes fails with "Invariant: Expected workStore to be initialized" on `/_global-error`, `/dashboard/[venueId]` and `/card/[id]`, mostly just after a local server was stopped; waiting a few seconds and building again has always passed.

### 2026-10-17: faster guest pages, till, dashboard and home page
- Faster: the hosted menu no longer ships the form validator (zod) to guests' phones: about 95 KB less to download (283 → 189 KB gzipped). Its option lists moved to `lib/venue/constants`.
- Faster: the guest page's sheets (loyalty, Wi-Fi, feedback, card, Sudoku) download after the page instead of with it and open from memory once fetched (idle time, or the moment a finger touches the card). A slow phone stays responsive while the page loads (Lighthouse mobile: blocking time 170 → 30 ms on `/s`, 210 → 30 ms on `/menu`). A sheet that couldn't download offers "Try again".
- Changed: every uploaded image is stored as WebP at the size it's shown at (logo 512 px, cover 1600 px, dish 1200 px) with its metadata (location) removed; a 2 MB phone photo becomes about 50 KB. Big JPEGs are also shrunk in the browser before upload. Images are cached at the CDN for a year and answer repeats with 304.
- Faster: the menu tap shows a menu-shaped placeholder straight away, and the menu is fetched ahead while the guest is on the venue page.
- Faster: style-preset fonts (Playfair Display, Petrona, Outfit) are served from our own domain, not Google's; no render-blocking stylesheet or extra connections. The wordmark face is no longer preloaded on guest pages.
- Faster: a guest page finds the venue and its subscription in one query; a signed-in check finds the session and user in one query. A new server copy checks the schema and demos in one query before doing any setup. Idle database connections stay open 30 s (were 5 s) and Vercel closes them before suspending (`attachDatabasePool`).
- Faster: an open member card checks a one-query endpoint (`/api/cards/[id]/state`) and fetches the whole card only when something changed; checks every 4 s for 2 minutes, then every 15–30 s, and stop after 10 minutes (coming back to the tab starts over). Was a full card render every 5 s.
- Faster: the card link's page sends "Opening your card…" at once and streams the rest, so the move to the venue's page starts sooner.
- Faster: feedback saves its photo, reads sentiment and checks the stamp setting side by side; Google sentiment gets 1.5 s (was 5 s) before the built-in word list answers. The "reward ready" email, referral stamps and the till's "last used" time happen after the till has its answer; sign-up's verification and the password-reset email go after the response (which also stops the reset form's timing from revealing whether an account exists).
- Changed: joining loyalty no longer waits for the card email; it goes out just after, and the confirmation reads "Your card is on its way to {email}".
- Faster (till): a scanned card opens right on the till ("Opening card…" over the camera, one request, no page load); the address still becomes the card's, so reload and Back work. Cards opened from the Recent or search lists show a card-shaped placeholder while they load.
- Faster (till): "Stamp added" shows the moment it's tapped and the server confirms behind it; if the server refuses, the card goes back with the reason. Inside the stamp cooldown the till still asks "add another anyway?" first.
- Faster (till): the scanner uses the phone's own QR reader where there is one (Android Chrome), and downloads jsQR only when the camera opens. Escape closes it; a card that can't be opened offers "Scan again".
- Changed (till): redeeming a reward asks in the app's own dialog instead of the browser's; member search runs without a page load, with a Search key on phone keyboards.
- Faster (dashboard): saving an editor no longer reloads the phone preview (no white flash) or fetches the page again; only a new venue name or logo refreshes the sidebar. Preview updates are sent once per frame while typing, and "unsaved changes" is worked out a beat behind the keystrokes.
- Faster (dashboard): Overview's numbers come from one query per period instead of about ten, run side by side with the chart, tables, engagement and latest feedback (about 42 queries one after another → 15 for the whole page). The sidebar lists every venue with its plan and unread count in one query (was three per venue); loyalty and feedback pages load in parallel.
- Changed (dashboard): closing a card on Overview hides it at once (the page catches up in the background); opening the feedback inbox clears the sidebar's unread count on screen, and "read" is recorded after the page is sent.
- Faster (dashboard): page-shaped loading placeholders for every dashboard page (editors with the phone, lists, forms); typing a QR label or dragging the colour fetches one preview, not one per key; unpairing a till or removing a staff member updates the list in place.
- Faster: indexes for a guest's visits, a venue's cards, consent links, Razorpay's webhook and sign-in tokens; feedback and sign-in check both their rate limits in one database write.
- Faster: the home page is static (served from the CDN, no server work per visit). Its signed-in bits read a `tt_signed_in` hint cookie in the browser, set and cleared with the session (it proves nothing; the HttpOnly session does). The hero phone shows a 22 KB picture of the demo (`public/demo/hero-poster.webp`, a 300×630 screenshot at 2×; take a new one when the demo's look changes); the live demo loads over it once the page has settled, or the moment a pointer or finger reaches it.
- Faster: signing in goes straight to the venue last open on that device (if it's theirs) or their only venue, not via /dashboard's redirect; no extra page refresh after sign-in, sign-up, password reset or onboarding. Sign-in's three rate limits are one database write.
- Changed: sign-up and "forgot password" wait for the robot check before the button works ("Checking you're not a robot…"), instead of failing a quick submit; the connection to Cloudflare opens with the page. The Subscribe button preloads Razorpay's checkout.
- Faster: guest page analytics tracked together go out as one beacon and one database insert (opening the page was two). The card sheet reuses the card the grid tile just fetched.
- Changed: error toasts in the dashboard show a warning icon (not a tick) and stay up longer; any toast holds while the pointer or keyboard is on it. The phone preview dialog keeps focus inside it and returns it to its button. Guest pages and scripted scrolling respect "reduce motion". Phone keyboards show Next / Done / Go / Search on the guest, till, sign-in and dashboard fields.
- Removed: the unused `/api/venues/[id]` endpoint and its client method.

### 2026-10-09 (later): audit fixes and India launch prep
- Fixed (security): a member could be given a stamp a day with just their email; feedback stamps now need the one-time receipt from that feedback, join stamps are decided by the server, and owners can switch the feedback stamp off (Loyalty → Staff devices).
- Fixed (security): typing someone's email showed their card (and the QR code staff redeem rewards from); returning members are emailed it instead. Birthdays can't be overwritten by a later form.
- Fixed (security): the Wi-Fi password was in the page even behind the email gate; it's now fetched after the email is given.
- Fixed: emails, announcements and the Monday summary ran on London time; each venue now uses its own time zone (IST by default).
- Fixed: scan numbers could be inflated by anyone; the analytics endpoint now checks the venue, limits event size and caps each address per venue.
- Fixed (security): rate limits trusted the client's own X-Forwarded-For; they now read the proxy's entry (`TRUSTED_PROXY_COUNT`, `CLIENT_IP_HEADER`) and forget old entries.
- Fixed: the mailer reported success before Resend answered, so failed emails were never retried; outbox rows now record sent/failed and keep no working private links.
- Added: daily clean-up of expired sessions, links, pairings, 90-day-old email copies and 400-day-old analytics.
- Fixed: Razorpay webhooks are applied from the subscription's live state, so late or out-of-order events can't flip a venue on or off.
- Fixed: feedback photos capped per venue per day; feedback refused when the owner hid the card; staff invites need a confirmed email and are capped per day.
- Changed: changing a page address keeps old printed QR codes working, and no one else can claim an old or deleted venue's address.
- Fixed: two tills (or a double tap) could redeem one reward twice or stamp past the cooldown; cards are locked while they change. Joins with the same email at once no longer fail; the AI quota can't be overspent.
- Added: `DATABASE_SSL_CA` / `DATABASE_SSL=verify` to check the database's certificate.
- Changed: marketing opt-in links open a Confirm button instead of confirming on open (email scanners open links).
- Changed: login limits are per account and address, so nobody can lock an owner out by guessing their password.
- Added: security headers (no framing by other sites, HSTS, nosniff, referrer policy).
- Added: legal pages for India (terms, DPDP privacy policy, cancellation & refunds, delivery, contact), linked from the home page, sign-up and sign-in.
- Added: guests can delete their own card and details from their card page; owners can delete a guest from the guest list.
- Added: the server lists missing production settings at startup; `.env.example` and the README cover every variable.
- Changed: India defaults: new venues start in ₹, Indian number and date formats, 18+ for offers at Indian venues.
- Removed: Spanish. Guest pages are English only.
- Removed: the guest page's "Open Wi-Fi settings" button (a web page can't open them reliably); the Wi-Fi card shows the network and a one-tap password copy.
- Added: "What guests said this week" on the overview: an AI summary of the last 7 days of feedback (headline, what guests liked, what needs attention, one suggestion). Needs 3+ notes, is saved and only rewritten when new feedback arrives, and is never emailed. The privacy policy now says feedback text is summarised with AI.
- Fixed: the home page's "Password copied" card covered the demo phone's back button; the cards now sit clear of it and let taps through. Demo venues get a "Back to Tapmore · Start free trial" bar (not inside the hero phone, never on real venues).
- Faster: demo pages are served from code with no database queries; demo content is written to the database once per change, not on every start; Vercel runs in Mumbai (`bom1`) next to the database.
- Changed: the Tapmore logo kit replaces the old "T" mark: the logo (QR corners with a clay dot) beside the "tapmore" wordmark everywhere in the app, new favicon (.ico and .svg) and Apple icon, install manifests for the dashboard and the staff till (none on guest pages), and the share image on the home page.
- Changed: the product is renamed **Tapmore** (was Tabletap). The name comes from `BRAND.name` everywhere; internal cookie and storage names (`tt_…`) are unchanged so nobody is signed out and phones keep their saved cards.
- Fixed (Vercel): "max clients reached in session mode". Each serverless copy now keeps at most 2 database connections and lets idle ones go; no job timer runs on Vercel (Vercel Cron calls `/api/cron/run` daily, `vercel.json`); database updates take a lock so copies starting together don't clash. Use Supabase's Transaction pooler (port 6543) on Vercel.
- Removed: the `claude design` folder (four exported design mockups, 13 MB); the design lives in the code now.
- Removed: the unbuilt Apple/Google Wallet placeholder (it never issued a pass); members use the web card.
- Cleanup: removed dead code (3 unused functions, 3 unused types, 14 unused text strings, about 560 lines of unused CSS), needless exports, 4 unused demo images and the one-off SQLite-to-Postgres copy script.
- Fixed: scan counts. Visits by the venue's own team (signed in as owner, staff or admin) no longer count; a phone counts once per 30-minute visit even across tabs; "last N days" totals and the daily chart cover the same days in the venue's time zone (the Monday email too); the admin console counts visits, not page loads.
- Added: an "NFC links" button next to Print on Table cards: downloads a spreadsheet (CSV) with each table's NFC link beside its QR link, with tag-writing steps under "How do I write the NFC tags?". Tags are sold and set up separately. The overview's "Where scans came from" counts a table's QR scans and NFC taps together as one total per table.
- Fixed: the home page's two floating cards looked blurry (tilted text); they're straight now.
- Added (admin): "Cancel renewal" and "Delete venue" (type the venue's name) on every venue in the admin console. Deleting stops Razorpay billing; both are logged. Demo venues can't be deleted.
- Changed: the three demo venues stay for the home page, but the admin console's venue list, counts and revenue leave them out, so it shows only real venues.
- Changed: admins with no venue of their own land in the admin console, not the setup wizard; the console's sidebar no longer shows Help & contact. New venues default to ₹.
- Changed: Tapmore is its own business, a partnership firm (notarised deed), separate from NexLoop the way Blinkit is its own company within Eternal. The legal pages, Contact page and payments name "Tapmore, a partnership firm"; NexLoop appears nowhere.
- Changed: no GST on the price (₹999 a year) while the business isn't GST-registered; one switch (`CHARGES_GST`) brings "+ 18% GST" back everywhere.
- Added: an About page (Razorpay looks for one next to the policies).
- Changed: the Wi-Fi email gate is an owner option (Loyalty → Guest details → "Email for Wi-Fi", off by default; no longer needs marketing consent on). It only asks for an email: no loyalty join and no free stamp for Wi-Fi any more. The free stamp for feedback stays.

### 2026-10-09
- Added: Bento tile colours from the logo, the page colour, or picked, with a second colour (Auto gives brighter shades of the main one, so green stays green). Shades are nudged until text passes AA.
- Changed (from the Claude Design round): rewards card page, "Back soon" page for paused venues, menu in tile colours, Subscription page with every state and "Subscribe again" (starts when the paid year ends), Overview with 7/30/90 days, "What to do next" and unread feedback, live preview in the editor, onboarding touches, till member line and online status, admin revenue chart and attention actions, marketing site, sign-up, and print formats (A6, tent, round sticker, Wi-Fi sign).
- Changed: the Grid layout is now **Bento**: the venue name big over the cover like a poster, then colourful tiles (loyalty with stamps out of total, a tall menu tile, a bright Wi-Fi tile that copies the password in one tap, feedback, Google review, Sudoku). Tiles open as bottom sheets. Their three shades come from one "Tile colour" (default: the page colour, or deep green), and always keep text readable.
- Changed: on every layout, the guest page shows the venue name big over the cover photo. The Header setting (Logo left, Centred, No logo) now arranges it, including on Bento, where it used to be ignored.
- Removed: the English / Español switch on the guest page and menu. Guests still get Spanish when their phone is set to it.

### 2026-10-08 (later)
- Changed: one plan instead of Free and Pro: ₹999 + 18% GST a year per venue, every feature included, 7-day free trial with no card. Pro markers and upgrade hints are gone.
- Changed: when a venue has no paid subscription and no trial left, its guest page goes offline; the owner can still sign in and subscribe, and the page comes back as it was.
- Changed: billing moved from Stripe to Razorpay Subscriptions (Checkout pop-up, signed webhook, cancel at the end of the paid year).
- Removed: the "Powered by" footer on guest pages and menus.
- Added (admin): account actions: resend the confirmation email, email a password reset link, block / unblock (signs them out everywhere), delete with the email typed to confirm. Admins and super admins are protected.
- Added (admin): an activity log of every admin change, with who made it.
- Added (admin): super admins (`ADMIN_EMAILS`) can make other verified accounts admins, or remove them, from Accounts.
- Changed: sign-ins last 90 days from the last visit, so people who come back stay signed in.
- Added (admin): "Edit for owner". The support view stays read-only until an admin switches editing on for that venue (30 minutes, then it switches itself off). Every save is logged with what changed; billing and deleting the venue stay with the owner.
- Fixed: deleting a venue or an account now cancels its Razorpay subscription too.
- Added (admin): Paying / Trial / Unpaid / Free access / Suspended filters, "Extend trial by 7 days", "Give free access", and a revenue panel (yearly and monthly recurring, churn, won't-renew, failing payments).

### 2026-10-08
- Added: "Changes saved" toasts with Undo (restores the version before the last save; undo twice to redo).
- Changed: the trial countdown and "confirm your email" share one slim bar; the email reminder can be snoozed for a day.
- Added: "How do I…?" help for the Google review link, pairing a till and printing at 100%, plus "Help & contact" in the sidebar (`NEXT_PUBLIC_SUPPORT_EMAIL`).
- Added: setup checklist links open the exact card and highlight it; full-screen "Preview" on phones; loading placeholders for dashboard pages.
- Added: social fields accept @handles.
- Added: English / Español switch on the guest page and menu (`tt_lang` cookie).
- Changed: the owner's own preview always shows "Suggestion box" (outside the label A/B test), and the editor explains the test.
- Added: staff logins. Owners invite by email; staff sign in (or sign up) and can only open the till. The till shows recent stamps and rewards.
- Added (admin): scans in the last 7 days and last scan per venue; "View as owner" is now read-only.
- Fixed: dashboard pages scrolled sideways on phones.

### 2026-10-07
- Changed: full redesign to the Claude Design mockups (brand, marketing home, guest page, menu, dashboard, editors, onboarding, staff till, A4 table cards).
- Added: owners can hide any card, rename cards in their own words, and drag to reorder cards and menu items (keyboard arrows work too).
- Changed: the hosted menu now shows the venue's cover, logo and font; dishes are rows with photo thumbnails inside one card per section; coloured badges; tap a dish for a detail sheet; a "Most popular" strip when nothing is marked special; optional section descriptions.
- Changed: demo venues refresh from code on every start, with dish illustrations, badges, specials and explainers.
- Fixed: dashboard switches ignored clicks (the drawn track sat above the checkbox).
- Fixed: ngrok tunnels can load the dev server's scripts (`allowedDevOrigins`).
- Security: Next.js 16.3.8.
- Added (Pro): layout presets. Guest page cards as List, Grid (two tiles per row) or Compact; header with logo beside the name, centred, or no logo; Rounded, Pill or Square corners. Menus as List, Photo cards or Classic (printed-menu look with dotted leaders). Free venues keep their choice saved but see the defaults until they upgrade.

### 2026-10-04 (later)
- Added: Groq as the AI provider (`GROQ_API_KEY`), using gpt-oss for dish notes and Qwen for menu photos, with strict JSON schemas. Photos are shrunk in the browser before upload. Claude remains an option.
- Changed: the guest's card now shows on the venue's own page ("Your rewards card") instead of a separate page. After joining, the card appears in place, and the phone remembers it. Opening the emailed link also teaches the phone the card.
- Changed: a returning member who types their email again sees their card straight away, instead of "already a member" (owner's decision).
- Added: a **Scan a card** button on the staff screens that uses the camera inside the page, plus "Scan the next card" after stamping.

### 2026-10-04
- Added: staff stamping. Owners pair till phones/tablets with a one-time link; guests tap "Show to staff" on their card; staff scan, stamp, redeem and undo. There's a cooldown against double stamps, and every change is recorded in a stamp ledger. The guest's card updates live.
- Fixed: the Google review link is now offered to every guest after feedback (Google bans asking only happy guests). Marketing copy updated.
- Added: Monday summary email for owners, a background job runner (hourly, never repeats work) and `POST /api/cron/run` for external schedulers.
- Added: AI menu import (photo/PDF) and "What's this dish?" notes, both drafts the owner approves. Pro only, daily quota, off without `ANTHROPIC_API_KEY`.
- Added: announcement banner with an end date; menu badges, a specials strip, bigger text, photos first on phones.
- Added: automatic guest emails (reward ready, birthday, we miss you) with one-click unsubscribe, and refer-a-friend with abuse limits.
- Added: optional Turnstile captcha on sign-up and password reset; Node version pinned; an "email confirmed" notice in onboarding; login returns you to the page you were on after a session expires.
- Fixed: a stats object from the database couldn't be sent to the Loyalty page (found in browser testing).
- Tests: 70 unit tests and 37 browser checks pass.

### 2026-10-03
- Fixed: no scrollbar inside the phone frames (home page and dashboard preview). Guest pages accept `?embed=1`, which hides the scrollbar but keeps scrolling.
- Fixed (security): when `APP_URL` is set, email links and the cross-origin check always use it instead of request headers. Before, a forged header could make password-reset emails link to another site. This was also needed to run behind ngrok.
- Added: ngrok installed for sharing a live preview from this computer.

### 2026-10-02
- Added: this roadmap file.
- Fixed: the database now adds new tables automatically after a code change, so the dev server no longer needs a restart (sign-up was failing with "no such table: users").

### 2026-10-01
- Added: the self-serve owner side (accounts, onboarding wizard, dashboard and editors, QR codes and print sheet, guests, feedback, Free/Pro plans with Stripe and dev mode, admin panel, marketing home page, terms page).
- Added: 25 new tests for the owner side, bringing the total to 52, plus an end-to-end check in Chrome.
