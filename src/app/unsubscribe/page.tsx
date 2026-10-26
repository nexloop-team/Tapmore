import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { firstParam } from "@/server/request";
import { findByUnsubscribeToken } from "@/server/repositories/retention";
import { getVenueRecord } from "@/server/repositories/venues";
import "@/styles/landing.css";
import "@/styles/pages.css";

// Blocks on purpose (Cache Components): opened from an email link; the token decides what the page says.
export const instant = false;

export const metadata: Metadata = { title: { absolute: "Unsubscribe" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Linked from every birthday email. Asks for a click rather than unsubscribing
 * on page load, because email scanners open links before people do.
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const params = await searchParams;
  if (firstParam(params.done)) {
    return (
      <main className="page-wrapper simple-page">
        <div className="simple-card">
          <h1>You&apos;re unsubscribed</h1>
          <p>You won&apos;t get birthday emails from this venue any more. Your loyalty card still works as before.</p>
        </div>
      </main>
    );
  }
  const token = firstParam(params.token);
  const guest = token ? await findByUnsubscribeToken(token) : null;
  const venueName = guest ? (await getVenueRecord(guest.venueId))?.config.name : null;
  return (
    <main className="page-wrapper simple-page">
      <div className="simple-card">
        {guest && venueName ? (
          guest.unsubscribed ? (
            <>
              <h1>Already unsubscribed</h1>
              <p>You don&apos;t get birthday emails from {venueName}.</p>
            </>
          ) : (
            <>
              <h1>Stop birthday emails from {venueName}?</h1>
              <p>You&apos;ll stop getting birthday emails. Your loyalty card and stamps stay as they are.</p>
              <form method="post" action="/api/unsubscribe" style={{ marginTop: 18 }}>
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="primary-btn">
                  Unsubscribe
                </button>
              </form>
            </>
          )
        ) : (
          <>
            <h1>This link isn&apos;t valid</h1>
            <p>It may be incomplete. Try the link in your email again.</p>
          </>
        )}
        <p style={{ marginTop: 16, fontSize: 12 }}>{BRAND.name}</p>
      </div>
    </main>
  );
}
