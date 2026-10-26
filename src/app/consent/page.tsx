import type { Metadata } from "next";
import { CheckCircle } from "@/components/icons";
import { createTranslator, LOCALE } from "@/lib/i18n";
import { getDb } from "@/server/db";
import { findCustomerByConsentToken } from "@/server/repositories/customers";
import { getVenueRecord } from "@/server/repositories/venues";
import { firstParam } from "@/server/request";
import "@/styles/landing.css";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): opened from an email link; the token decides what the page says.
export const instant = false;

export const metadata: Metadata = { title: { absolute: "Email preferences" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * The double-opt-in link (`?token=`) lands here and asks for a tap, because
 * email scanners open links before people do. The button posts to
 * /api/consent/confirm, which comes back with `?status=`.
 */
export default async function ConsentPage({ searchParams }: PageProps<"/consent">) {
  const params = await searchParams;
  const { t, tf } = createTranslator(LOCALE);
  const status = firstParam(params.status);
  const token = firstParam(params.token);
  const pending = token && !status ? await findCustomerByConsentToken(await getDb(), token) : null;
  const venueName = pending?.marketing_consent === "pending" ? (await getVenueRecord(pending.venue_id))?.config.name : null;

  return (
    <main className="page-wrapper simple-page">
      <div className="simple-card">
        {status === "confirmed" ? (
          <>
            <div className="simple-icon ok">
              <CheckCircle />
            </div>
            <h1>{t("consent_confirmed_title")}</h1>
            <p>{t("consent_confirmed_body")}</p>
          </>
        ) : venueName ? (
          <>
            <h1>{tf("consent_confirm_title", { business: venueName })}</h1>
            <p>{t("consent_confirm_body")}</p>
            <form method="post" action="/api/consent/confirm" style={{ marginTop: 18 }}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="primary-btn">
                {t("consent_confirm_button")}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>{t("consent_invalid_title")}</h1>
            <p>{t("consent_invalid_body")}</p>
          </>
        )}
      </div>
    </main>
  );
}
