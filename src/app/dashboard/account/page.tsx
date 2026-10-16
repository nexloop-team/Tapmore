import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/blocks";
import { AccountForms } from "@/components/dashboard/SettingsForms";
import { ResendVerification } from "@/components/dashboard/Shell";
import { initials } from "@/lib/format";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="page page-narrow">
      <PageHeader title="Account" />
      {/* Who's signed in, and whether their email is confirmed, at a glance. */}
      <section className="card account-summary">
        <span className="avatar account-avatar" aria-hidden>
          {initials(user.name || user.email)}
        </span>
        <div className="account-who">
          <strong>{user.name || "Your account"}</strong>
          <span>{user.email}</span>
        </div>
        {user.emailVerified ? (
          <span className="account-verified">
            <CircleCheck aria-hidden /> Email confirmed
          </span>
        ) : (
          <span className="account-unverified">
            <span>Confirm your email address.</span>
            <ResendVerification />
          </span>
        )}
      </section>
      <AccountForms name={user.name} email={user.email} />
    </div>
  );
}
