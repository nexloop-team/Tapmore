import type { Metadata } from "next";
import type { ReactNode } from "react";
import { uiFont } from "@/app/fonts";
import { AppShell } from "@/components/dashboard/Shell";
import { BRAND } from "@/config/brand";
import { platformCounts } from "@/server/admin";
import { requireAdminPage } from "@/server/dashboard";
import { listVenuesForUser } from "@/server/repositories/venues";
import "@/styles/app.css";

// Blocks on purpose (Cache Components): the console is for operators only, so nothing is shown before the sign-in check.
export const instant = false;

export const metadata: Metadata = { title: { default: "Admin", template: `%s · Admin · ${BRAND.name}` }, robots: { index: false, follow: false }, manifest: "/brand/app.webmanifest" };

/** Operator console shell. Gated by ADMIN_EMAILS; each page checks again, since layouts don't re-run on client navigation. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  const totals = await platformCounts();
  const ownsVenues = (await listVenuesForUser(user.id)).length > 0;
  return (
    <div className={`app ${uiFont.variable}`}>
      <AppShell mode="admin" venues={[]} user={{ name: user.name, email: user.email, isAdmin: true }} counts={{ "/admin/venues": totals.venues, "/admin/accounts": totals.accounts }} ownsVenues={ownsVenues}>
        {children}
      </AppShell>
    </div>
  );
}
