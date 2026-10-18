import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { TRIAL_DAYS } from "@/lib/plans";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";
import { inviteVenueName } from "@/server/services/staff-invites";


export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = firstParam((await searchParams).next);
  if (await currentUser()) redirect(safeNext(next));
  // Invited staff sign up to reach the till, not to create a venue.
  const joiningStaff = next.startsWith("/staff/");
  // From an invite link: name the venue they're joining.
  const inviteToken = joiningStaff ? new URLSearchParams(next.split("?")[1] ?? "").get("t") : null;
  const staffVenue = inviteToken ? await inviteVenueName(inviteToken) : null;
  return (
    <>
      {joiningStaff && <span className="auth-badge">Staff invite</span>}
      <h1>{staffVenue ? `Join the till at ${staffVenue}` : joiningStaff ? "Create your staff account" : "Start your free trial"}</h1>
      <p>
        {joiningStaff
          ? "Set a password and you're ready to stamp cards. You'll only see the till, where you scan cards and add stamps."
          : `Try everything free for ${TRIAL_DAYS} days. No card needed.`}
      </p>
      <SignupForm next={next || undefined} staffVenue={staffVenue} />
      {joiningStaff && !staffVenue && inviteToken && <p className="hint">This invite has expired or was already used. Ask the owner to resend the invite.</p>}
      <p className="auth-alt">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
      </p>
    </>
  );
}
