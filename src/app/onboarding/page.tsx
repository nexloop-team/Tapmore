import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { ResendVerification } from "@/components/dashboard/Shell";
import { isAdmin, isListedSuperAdmin, requireUser } from "@/server/auth/session";
import { listVenuesForUser } from "@/server/repositories/venues";
import { aiConfigured, aiImportLimits } from "@/server/services/ai";
import { googleConfigured } from "@/server/services/google";
import { uiFont } from "@/app/fonts";
import { firstParam } from "@/server/request";
import "@/styles/app.css";

// Blocks on purpose (Cache Components): the setup wizard is for the signed-in owner; it waits for that check.
export const instant = false;

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  const params = await searchParams;
  const verified = firstParam(params.verified);
  const hasVenues = (await listVenuesForUser(user.id)).length > 0;
  // Admins run the console, not a café: straight there, unless they chose to add a venue (?create=1).
  if (isAdmin(user) && !hasVenues && !firstParam(params.create)) redirect("/admin");
  const adminUnconfirmed = isListedSuperAdmin(user) && !user.emailVerified;
  return (
    <div className={`app ${uiFont.variable}`}>
      <OnboardingWizard
        // We sell in India: rupees first, whatever language the browser is set to (many Indian phones say en-US).
        defaultCurrency="INR"
        google={googleConfigured()}
        aiImport={aiConfigured() ? aiImportLimits() : null}
        exitHref={hasVenues ? "/dashboard" : isAdmin(user) ? "/admin" : null}
        notice={
          <>
            {verified === "1" && <div className="notice notice-ok">Your email is confirmed. Thanks! Now let&apos;s set up your business.</div>}
            {verified === "0" && <div className="notice notice-error">That confirmation link has expired or was already used.</div>}
            {adminUnconfirmed && (
              <div className="notice notice-info">
                <span>
                  This email is a super admin. Confirm it (the link is in your inbox, or in the server log during development) to open the admin
                  console at /admin.
                </span>
                <ResendVerification />
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
