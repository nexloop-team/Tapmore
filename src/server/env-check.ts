import { missingLegalDetails } from "@/config/legal";

interface ConfigProblem {
  /** "error": something guests or owners will hit; "warn": works, but not as it should for a launch. */
  level: "error" | "warn";
  message: string;
}

/**
 * What a production deployment still needs, checked once at startup so a
 * missing setting shows up in the log instead of as a broken QR code, an
 * email that never arrives or a payment page that won't open.
 */
function productionConfigProblems(env: NodeJS.ProcessEnv = process.env): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const error = (message: string) => problems.push({ level: "error", message });
  const warn = (message: string) => problems.push({ level: "warn", message });
  const has = (key: string) => !!env[key]?.trim();

  if (!has("APP_URL")) error("APP_URL is not set. It's printed into every QR code: set it to your final https:// address before printing any.");
  else if (!/^https:\/\//.test(env.APP_URL!)) warn("APP_URL doesn't start with https://.");

  if (has("DATABASE_URL") && env.VERCEL && /pooler\.supabase\.com:5432\//.test(env.DATABASE_URL!)) {
    error("DATABASE_URL uses Supabase's Session pooler (port 5432), which allows only a few connections: on Vercel use the Transaction pooler (port 6543).");
  }
  if (env.VERCEL && !has("CRON_SECRET")) error("CRON_SECRET is not set: on Vercel, the daily jobs (birthday emails, clean-up) only run through Vercel Cron, which needs it.");
  if (!has("DATABASE_URL")) warn("DATABASE_URL is not set, so the embedded database in DATA_DIR is used. It needs a persistent volume and backups.");
  else if (!has("DATABASE_SSL_CA") && !["verify", "off"].includes(env.DATABASE_SSL ?? "")) {
    warn("The database connection is encrypted but its certificate isn't checked. Set DATABASE_SSL_CA (Supabase: Database settings → SSL certificate).");
  }
  if (!has("S3_BUCKET")) warn("S3_* is not set, so images are stored on this server's disk under DATA_DIR. It needs a persistent volume.");

  if (!has("RESEND_API_KEY")) error("RESEND_API_KEY is not set: no email is sent (sign-up confirmations, password resets, loyalty cards).");
  if (!has("MAIL_FROM") || /\.local>?$/.test(env.MAIL_FROM!.trim())) error("MAIL_FROM is not set to an address on your verified sending domain.");
  if (!has("NEXT_PUBLIC_SUPPORT_EMAIL") || /\.local$/.test(env.NEXT_PUBLIC_SUPPORT_EMAIL!.trim())) {
    error("NEXT_PUBLIC_SUPPORT_EMAIL is not set: the help page, policies and emails show a placeholder address. (It's read at build time: rebuild after setting it.)");
  }

  const razorpay = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_PLAN_ID"].filter((key) => !has(key));
  if (razorpay.length === 3) warn("Razorpay is not set up, so owners can't pay. The Subscription page asks them to email support.");
  else if (razorpay.length) error(`Razorpay is half set up: ${razorpay.join(", ")} missing.`);
  if (razorpay.length < 3 && !has("RAZORPAY_WEBHOOK_SECRET")) error("RAZORPAY_WEBHOOK_SECRET is not set: renewals, failed payments and cancellations won't reach the app.");
  if (env.BILLING_DEV_MODE === "1") error("BILLING_DEV_MODE=1: anyone can switch a venue to paid without paying. Staging only.");

  if (!has("ADMIN_EMAILS")) warn("ADMIN_EMAILS is not set, so nobody can open /admin.");
  if (!has("TURNSTILE_SECRET_KEY") || !has("NEXT_PUBLIC_TURNSTILE_SITE_KEY")) error("Turnstile isn't set up, so sign-up and password reset have no bot check: scripts can create accounts and send reset emails.");
  if (env.DISABLE_JOBS === "1" && !has("CRON_SECRET")) error("DISABLE_JOBS=1 without CRON_SECRET: weekly summaries, guest emails and clean-up never run.");

  const legal = missingLegalDetails();
  if (legal.length) error(`Business details for the legal and contact pages are missing: ${legal.join(", ")}. Razorpay and Indian consumer law require them.`);
  return problems;
}

/** Logs the problems as one block, errors first. */
export function reportProductionConfig() {
  const problems = productionConfigProblems().sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  if (problems.length === 0) return;
  const lines = problems.map((problem) => `  ${problem.level === "error" ? "✗" : "!"} ${problem.message}`);
  console.error(`[config] ${problems.length} setting${problems.length === 1 ? "" : "s"} to fix before launch:\n${lines.join("\n")}`);
}
