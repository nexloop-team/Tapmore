import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";
import { firstParam } from "@/server/request";


export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = firstParam((await searchParams).next);
  if (await currentUser()) redirect(safeNext(next));
  const joiningStaff = next.startsWith("/staff/");
  return (
    <>
      <h1>{joiningStaff ? "Sign in to open the till" : "Welcome back"}</h1>
      <p>{joiningStaff ? "Use your own account. Staff accounts can stamp cards and nothing else." : "Sign in to your venue. You'll stay signed in on this device."}</p>
      <LoginForm next={next || undefined} />
      <p className="auth-alt">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>{joiningStaff ? "Create your staff account" : "Start a free trial"}</Link>
      </p>
    </>
  );
}
