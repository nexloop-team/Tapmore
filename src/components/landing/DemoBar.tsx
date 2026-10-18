"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND } from "@/config/brand";

/**
 * On the demo venues only: they're opened from our home page, so this leads
 * back there (and to the free trial). Real venues' guest pages never show it.
 *
 * Both links lead to pages with prebuilt shells, so prefetching one fetches
 * its styles and fonts too: that happens when a finger or pointer reaches
 * the link, not merely because it's on screen, so a prospect who stays on
 * the demo doesn't spend the data.
 */
export function DemoBar() {
  const router = useRouter();
  const warmHome = () => router.prefetch("/");
  const warmSignup = () => router.prefetch("/signup");
  return (
    <div className="demo-bar" role="note">
      <Link href="/" prefetch={false} className="demo-bar-back" onPointerEnter={warmHome} onTouchStart={warmHome} onFocus={warmHome}>
        ← Back to {BRAND.name}
      </Link>
      <span className="demo-bar-note">This is a demo</span>
      <Link href="/signup" prefetch={false} className="demo-bar-cta" onPointerEnter={warmSignup} onTouchStart={warmSignup} onFocus={warmSignup}>
        Start free trial
      </Link>
    </div>
  );
}
