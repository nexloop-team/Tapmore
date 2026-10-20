# Pilot checklist

The smallest setup that puts Tapmore in front of 20–30 real cafés to find out whether it works, before spending on the full launch. Cost: about ₹0 a month plus the domain.

**The pilot is free for cafés.** No payments, no Razorpay, no firm paperwork yet. If the pilot works, do [Before charging money](#before-charging-money) at the end.

---

## 1. The one thing you can't undo

- [ ] Buy the domain (e.g. `tapmore.in`) and decide the address (e.g. `https://tapmore.in`). It becomes `APP_URL` and is printed into every QR code, so pilot cafés' table cards break if it ever changes. Check nobody else uses the name first (a Google search and [ipindia.gov.in](https://ipindia.gov.in)).

## 2. Free accounts (about an hour)

- [ ] **Supabase** (free plan), project in **Mumbai**:
  - Database: Project → Connect → **Transaction pooler** string (port **6543**) with your password. That's `DATABASE_URL`.
  - Storage: create a private bucket `tapmore`, then Storage settings → S3 access keys. Those are the `S3_*` settings.
- [ ] **Resend** (free plan): add your domain and the DNS records it shows. Sign-up emails won't arrive without this.
- [ ] **Cloudflare Turnstile** (free): add your domain, copy the site key and secret key. Stops bots signing up.
- [ ] **Vercel**: import the GitHub repo (keep the repo private).
- [ ] Optional but worth it: **Sentry** (free) so you hear about errors before cafés tell you; **Groq** (free) for AI menu import.

> Vercel's free Hobby plan is for non-commercial use. A free pilot is a grey area; Vercel Pro ($20/month) removes the doubt. Your call.

## 3. Settings in Vercel

Project → Settings → Environment Variables:

| Setting | Value |
|---|---|
| `APP_URL` | Your final address, e.g. `https://tapmore.in` |
| `DATABASE_URL` | Supabase Transaction pooler string (port 6543) |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | From Supabase Storage |
| `RESEND_API_KEY`, `MAIL_FROM` | From Resend; `MAIL_FROM` like `Tapmore <hello@tapmore.in>` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Where cafés write to you (your Gmail is fine for now) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | From Cloudflare |
| `CRON_SECRET` | Any long random string (daily jobs need it) |
| `ADMIN_EMAILS` | Your email |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `LEGAL_JURISDICTION_CITY`, `SUPPORT_PHONE`, `GRIEVANCE_OFFICER_NAME` | Your name or firm, address, city, phone, and your own name as Grievance Officer |
| `SENTRY_DSN`, `GROQ_API_KEY` | If you made those accounts |

- [ ] All set, then **Deploy**.
- [ ] Domain: Vercel → Settings → Domains → add yours and follow the DNS steps.
- [ ] Vercel → Logs: the `[config]` list may still mention Razorpay (expected); nothing else should be marked ✗.

## 4. Try it yourself first (30 minutes, on your phone)

- [ ] Sign up → verification email lands in your **inbox**, not spam.
- [ ] Onboard a pretend café, add a menu, download and print a QR code.
- [ ] Scan it with your phone on mobile data: page opens, menu works.
- [ ] Join the loyalty card (email arrives), leave feedback.
- [ ] Pair a second phone as the till and stamp your card.
- [ ] `/admin` opens and shows your café.

## 5. Running the pilot

- [ ] **Give every pilot café free access in `/admin`.** Otherwise the 7-day trial ends and their guest page goes offline.
- [ ] Help the first few set up in person; watch where they get stuck.
- [ ] Once a week, look at:
  - **Usage:** each café's scans, members and feedback (dashboard / `/admin`). Who is actually using it?
  - **Errors:** Sentry or Vercel Logs.
  - **Emails:** Resend's free plan sends 100 a day. Every guest who joins a loyalty card gets an email, so check Resend's dashboard; past the limit, emails quietly stop.
- [ ] Ask every café after 2–4 weeks: would you pay ₹999 a year for this? What's missing?

**Known limits of the free setup:** Supabase free has no backups (fine for a pilot, not for paying customers), and pauses a project that gets no traffic for a week (cafés scanning daily keep it awake).

---

## Before charging money

Only once the pilot says yes:

- [ ] Partnership paperwork (deed, PAN, current account, Udyam), then activate Razorpay and set the `RAZORPAY_*` settings and webhook (see the README's [Going to production](../README.md#going-to-production)).
- [ ] Test a payment, renewal and cancellation in Razorpay test mode, then one real payment and a refund.
- [ ] Supabase Pro (daily backups) and Vercel Pro.
- [ ] A support email on your domain.
- [ ] A lawyer reviews `/terms`, `/privacy` and `/refunds`.
- [ ] Run a security review of the code.
- [ ] Move pilot cafés from free access to paid (or keep them free as a thank-you).
