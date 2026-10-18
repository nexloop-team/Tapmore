import type { Metadata, Viewport } from "next";
import { AppServiceWorker } from "@/components/AppServiceWorker";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { uiFont } from "@/app/fonts";
import { AppShell } from "@/components/dashboard/Shell";
import { BRAND } from "@/config/brand";
import { isAdmin, requireUser } from "@/server/auth/session";
import { accessBadge } from "@/lib/plans";
import { listVenueSummariesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

// Blocks on purpose (Cache Components): the sidebar is the signed-in owner's venues; until we know who's asking there's nothing to show but the page's own loading placeholder.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s · ${BRAND.name}` },
  robots: { index: false },
  manifest: "/brand/app.webmanifest",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#24573F" };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // One query for the whole sidebar, however many venues.
  const venues = (await listVenueSummariesForUser(user.id)).map((venue) => ({
    id: venue.id,
    name: venue.name,
    planLabel: accessBadge(venue.subscription).label,
    unreadFeedback: venue.unreadFeedback,
    logoUrl: venue.logoUrl,
  }));
  return (
    <div className={`app ${uiFont.variable}`}>
      <AppShell mode="venue" venues={venues} user={{ name: user.name, email: user.email, isAdmin: isAdmin(user) }} lastVenueId={(await cookies()).get("tt_venue")?.value ?? null}>
        {children}
      </AppShell>
      <AppServiceWorker scope="/dashboard" />
    </div>
  );
}
