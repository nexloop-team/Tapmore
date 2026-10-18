import { createTranslator, LOCALE } from "@/lib/i18n";
import "@/styles/landing.css";
import "@/styles/pages.css";

/**
 * What the card link shows the moment it's opened (a static shell, before
 * the card is looked up): the same "Opening your card…" line the page shows
 * while it moves on to the venue's own page.
 */
export default function Loading() {
  const { t } = createTranslator(LOCALE);
  return (
    <main className="page-wrapper rc-page" aria-busy="true">
      <p className="rc-opening" role="status">
        {t("rc_opening")}
      </p>
    </main>
  );
}
