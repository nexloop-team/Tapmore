import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { uiFont } from "@/app/fonts";
import { BRAND } from "@/config/brand";
import { ConfirmProvider } from "@/components/dashboard/confirm";
import { OnlineStatus } from "@/components/staff/OnlineStatus";
import { TillCardHost } from "@/components/staff/TillCardHost";
import { TillQueue } from "@/components/staff/TillQueue";
import { AppServiceWorker } from "@/components/AppServiceWorker";
import { getVenueRecord } from "@/server/repositories/venues";
import { currentStaffDevice } from "@/server/services/staff";
import "@/styles/app.css";

// Blocks on purpose (Cache Components): the till's top bar names the paired device and its venue, which only the device's cookie tells us; the till pages have their own loading placeholders.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Staff", template: `%s · ${BRAND.name} staff` },
  robots: { index: false, follow: false },
  manifest: "/brand/till.webmanifest",
  // Added to an iPhone's home screen, the till opens full screen like an app.
  appleWebApp: { capable: true, title: "Till", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#24573F" };

/**
 * Till screens for paired staff devices: big buttons, nothing else. Always
 * dark, so the screen doesn't glare behind a counter and the green actions pop.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const device = await currentStaffDevice();
  const venue = device ? await getVenueRecord(device.venueId) : null;
  return (
    <div className={`app till ${uiFont.variable}`}>
      <header className="till-bar">
        <Link className="till-brand" href="/staff">
          <BrandMark size={32} />
          <span>
            {venue ? <strong>{venue.config.name}</strong> : <strong className="till-wordmark">{BRAND.name}</strong>}
            {device ? <span className="till-device">Till · {device.label}</span> : null}
          </span>
        </Link>
        {device && <OnlineStatus />}
      </header>
      <main className="staff-main">
        <AppServiceWorker scope="/staff" />
        {device && <TillQueue />}
        <ConfirmProvider>{device ? <TillCardHost>{children}</TillCardHost> : children}</ConfirmProvider>
      </main>
    </div>
  );
}
