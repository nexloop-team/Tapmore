"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { scrollMotion } from "@/lib/browser";

/**
 * Links like /design#wifi land on the Wi-Fi card: scrolled to the middle of
 * the screen, its first field focused, and briefly highlighted. (Client-side
 * navigation doesn't update CSS :target, so this does it by hand.)
 */
export function HashFocus() {
  const pathname = usePathname();

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    // The page may still be streaming in behind a loading placeholder, so look for a couple of seconds.
    let tries = 0;
    const timer = setInterval(() => {
      const target = document.getElementById(id);
      if (!target && ++tries < 25) return;
      clearInterval(timer);
      if (!target) return;
      target.scrollIntoView({ behavior: scrollMotion(), block: "center" });
      target.classList.remove("flash-target");
      void target.offsetWidth;
      target.classList.add("flash-target");
      target.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select, button")?.focus({ preventScroll: true });
    }, 80);
    return () => clearInterval(timer);
  }, [pathname]);

  return null;
}
