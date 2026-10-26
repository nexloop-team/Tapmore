import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { currentUser, isAdmin, requireApiUser, requireUser } from "./auth/session";
import { assertSameOrigin, ServiceError } from "./http";
import { accessState } from "@/lib/plans";
import { editGrantExpiry, logAdminAction } from "./repositories/admin-actions";
import { getSubscription } from "./repositories/subscriptions";
import { getVenueRecord, isManagerRole, venueRole } from "./repositories/venues";
import { requireVenueAccess } from "./services/venue-admin";

/**
 * Route handlers under /api/dashboard/venues/[venueId]: signed in, owner (or
 * operator), and same-origin for writes.
 *
 * Admins can look at any venue, but only change it while "Edit for owner" is
 * on, and every change they make is logged. Billing and deleting the venue
 * (`write: "owner"`) stay with its own team.
 */
export async function venueFromRequest(request: Request, venueId: string, options: { write?: boolean | "owner" } = {}) {
  if (options.write) assertSameOrigin(request);
  const user = await requireApiUser();
  const venue = await requireVenueAccess(user, venueId);
  if (options.write && !isManagerRole(await venueRole(user.id, venueId))) {
    if (options.write === "owner") throw new ServiceError(403, "Only the venue's owner can do this.");
    if (!isAdmin(user) || !await editGrantExpiry(user.id, venueId)) throw new ServiceError(403, "This is a read-only support view. Turn on \"Edit for owner\" to make changes.");
    await logAdminAction(user, "Edited for owner", { type: "venue", id: venueId, label: venue.config.name }, await describeWrite(request, venueId));
  }
  return { user, venue };
}

const WRITE_LABELS: Record<string, string> = {
  "/settings": "venue settings",
  "/media": "uploaded an image",
  "/restore": "undid the last save",
  "/staff-members": "staff logins",
  "/staff-devices": "till devices",
  "/ai/menu-import": "AI menu import",
  "/ai/explain": "AI dish notes",
  "/reviews": "Google reviews",
};

/** For the activity log: "saved branding, menus", "staff logins (DELETE)" and so on. */
async function describeWrite(request: Request, venueId: string): Promise<string> {
  const path = new URL(request.url).pathname.replace(`/api/dashboard/venues/${venueId}`, "") || "/";
  if (path === "/") {
    const body = (await request.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const sections = body ? Object.keys(body).filter((key) => body[key] !== undefined) : [];
    return sections.length ? `saved ${sections.join(", ")}` : "saved the venue";
  }
  const base = Object.keys(WRITE_LABELS).find((key) => path === key || path.startsWith(`${key}/`));
  const label = base ? WRITE_LABELS[base] : path;
  return request.method === "DELETE" ? `${label} (removed)` : label;
}

/** Server pages under /dashboard/[venueId]: the venue with its subscription, or a 404 for anyone else. */
export const loadDashboardVenue = cache(async (venueId: string) => {
  const user = await requireUser();
  // Side by side; nothing is shown until the checks below pass.
  const [venue, role, subscription] = await Promise.all([getVenueRecord(venueId), venueRole(user.id, venueId), getSubscription(venueId)]);
  if (!venue) notFound();
  // Staff logins only reach the till; their list of venues says so.
  if (role === "staff" && !isAdmin(user)) redirect("/dashboard");
  if (!isManagerRole(role) && !isAdmin(user)) notFound();
  return { user, venue, role, subscription, access: accessState(subscription) };
});

/** Admin API routes. */
export async function requireApiAdmin(request: Request) {
  assertSameOrigin(request);
  const user = await requireApiUser();
  if (!isAdmin(user)) throw new ServiceError(404, "Not found");
  return user;
}

/** Admin pages. */
export async function requireAdminPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}
