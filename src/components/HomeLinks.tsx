"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { subscribeNever } from "@/lib/browser";

/**
 * The home page's signed-in bits. The page itself is static (served from the
 * CDN), so they read the `tt_signed_in` hint cookie in the browser rather
 * than the session on the server.
 */
function useSignedIn(): boolean {
  return useSyncExternalStore(subscribeNever, () => document.cookie.split("; ").includes("tt_signed_in=1"), () => false);
}

export function NavActions() {
  if (useSignedIn()) {
    return (
      <Link className="mk-btn mk-btn-ink" href="/dashboard">
        Dashboard
      </Link>
    );
  }
  return (
    <>
      <Link href="/login">Sign in</Link>
      <Link className="mk-btn mk-btn-ink" href="/signup">
        Start free trial
      </Link>
    </>
  );
}

/** "Start your free trial", or "Go to your dashboard" for someone already signed in. */
export function StartLink({ className }: { className: string }) {
  const signedIn = useSignedIn();
  return (
    <Link className={className} href={signedIn ? "/dashboard" : "/signup"}>
      {signedIn ? "Go to your dashboard" : "Start your free trial"} <ArrowRight aria-hidden />
    </Link>
  );
}
