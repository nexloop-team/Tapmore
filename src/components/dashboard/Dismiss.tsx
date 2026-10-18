"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, type ReactNode } from "react";

/**
 * Hides (or brings back) one part of a page for this browser, remembered in
 * a cookie so the server leaves it out next time with no flash. `cookie`
 * holds a comma-separated list of hidden parts. The page is then fetched
 * again quietly, in the background.
 */
function useHidden(cookie: string) {
  const router = useRouter();
  return (part: string, hide: boolean) => {
    const current = (document.cookie.split("; ").find((entry) => entry.startsWith(`${cookie}=`))?.split("=")[1] ?? "").split(",").filter(Boolean);
    const next = hide ? [...new Set([...current, part])] : current.filter((p) => p !== part);
    document.cookie = `${cookie}=${next.join(",")}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  };
}

/** Closes the nearest `[data-dismissible]` around it at once; the server agrees on the next render. */
export function DismissButton({ cookie, part, label }: { cookie: string; part: string; label: string }) {
  const setHidden = useHidden(cookie);
  return (
    <button
      type="button"
      className="dismiss-btn"
      aria-label={label}
      title={label}
      onClick={(event) => {
        const box = event.currentTarget.closest<HTMLElement>("[data-dismissible]");
        if (box) box.hidden = true;
        setHidden(part, true);
      }}
    >
      <X aria-hidden />
    </button>
  );
}

export function ShowAgainButton({ cookie, part, children }: { cookie: string; part: string; children: ReactNode }) {
  const setHidden = useHidden(cookie);
  return (
    <button type="button" className="link-quiet show-again" onClick={() => setHidden(part, false)}>
      {children}
    </button>
  );
}
