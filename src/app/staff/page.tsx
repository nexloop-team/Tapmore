import { ScanLine, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { ScanCardButton } from "@/components/staff/ScanCardButton";
import { formatSince, initials } from "@/lib/format";
import { currentUser } from "@/server/auth/session";
import { listStaffVenuesForUser, listVenuesForUser } from "@/server/repositories/venues";
import { firstParam } from "@/server/request";
import { currentStaffDevice, recentTillActivity, searchMembers } from "@/server/services/staff";

/** Home screen of a paired till device: scan a card, or find a member by name or email. */
export default async function StaffHome({ searchParams }: PageProps<"/staff">) {
  const params = await searchParams;
  const paired = firstParam(params.paired);
  const device = await currentStaffDevice();

  if (!device) {
    const user = await currentUser();
    // A signed-in owner or staff member can open the till here without a pairing link.
    const tills = user ? [...(await listStaffVenuesForUser(user.id)), ...(await listVenuesForUser(user.id))] : [];
    return (
      <section className="till-message">
        {paired === "0" && <div className="notice notice-error">That pairing link has expired or was already used. Ask the owner for a new one.</div>}
        {params.invite === "0" && <div className="notice notice-error">That invite link has expired or was already used. Ask the owner to send a new one.</div>}
        {tills.length > 0 ? (
          <>
            <h1>Open the till</h1>
            <p>This turns the phone or tablet you&apos;re holding into a till for stamping cards.</p>
            {tills.map((venue) => (
              // A plain link: prefetching it would pair the device.
              <a key={venue.id} className="staff-btn staff-btn-primary" href={`/staff/open?v=${encodeURIComponent(venue.id)}`}>
                <ScanLine aria-hidden /> {venue.config.name}
              </a>
            ))}
          </>
        ) : (
          <>
            <h1>This isn&apos;t a staff device yet</h1>
            <p>
              Sign in with your staff login, or ask the venue owner to pair this device from their dashboard: <strong>Loyalty &amp; capture → Till</strong>.
            </p>
            <a className="staff-btn staff-btn-secondary" href="/login?next=%2Fstaff">
              Sign in with a staff login
            </a>
          </>
        )}
      </section>
    );
  }

  const q = firstParam(params.q).slice(0, 80);
  const matches = q ? await searchMembers(device, q) : [];
  const recent = q ? [] : await recentTillActivity(device);

  return (
    <>
      {paired === "1" && <div className="notice notice-ok">This device is ready for stamping. Keep it at the till.</div>}
      <ScanCardButton variant="hero" />
      <p className="till-hint">Ask the guest to open their card and tap “Show to staff”.</p>

      <div className="till-divider">
        <span>or find a member</span>
      </div>
      <form className="till-search" action="/staff" role="search">
        <Search aria-hidden />
        <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Find a member by name or email" autoComplete="off" />
      </form>
      <Link className="staff-btn staff-btn-secondary" href="/staff/new-member">
        <UserPlus aria-hidden /> Add a new member
      </Link>

      {recent.length > 0 && (
        <section aria-label="Recent">
          <h2 className="till-label">Recent</h2>
          <ul className="till-list">
            {recent.map((entry, index) => (
              <li key={`${entry.cardId}-${entry.at}-${index}`} className={entry.undone ? "undone" : undefined}>
                <Link href={`/staff/stamp?c=${entry.cardId}`}>
                  <span className="till-avatar" aria-hidden>
                    {initials(entry.name || "Guest")}
                  </span>
                  <span className="till-list-text">
                    <strong>{entry.name || "Guest"}</strong>
                    <span>
                      {entry.undone ? "Undone · " : ""}
                      {entry.kind === "redeem" ? `Redeemed ${entry.rewardName ?? "a reward"}` : `+${entry.delta} stamp${entry.delta === 1 ? "" : "s"}`}
                      {entry.deviceLabel ? ` · ${entry.deviceLabel}` : ""}
                    </span>
                  </span>
                  <span className="till-list-meta">{formatSince(entry.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && (
        <section aria-label="Members found">
          <h2 className="till-label">Members</h2>
          <ul className="till-list">
            {matches.length === 0 ? (
              <li className="till-empty">No members match “{q}”.</li>
            ) : (
              matches.map((match) => (
                <li key={match.cardId}>
                  <Link href={`/staff/stamp?c=${match.cardId}`}>
                    <span className="till-avatar" aria-hidden>
                      {initials(match.name || match.email)}
                    </span>
                    <span className="till-list-text">
                      <strong>{match.name || "Guest"}</strong>
                      <span>{match.email}</span>
                    </span>
                    <span className="till-list-meta">
                      {match.stamps} stamp{match.stamps === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </>
  );
}
