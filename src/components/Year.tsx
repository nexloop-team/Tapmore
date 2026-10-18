"use client";

import { useSyncExternalStore } from "react";
import { subscribeNever } from "@/lib/browser";

/**
 * This year, for a footer's ©. Read in the browser only, so a page built
 * once and served from the CDN still shows the current year (and the
 * prerendered HTML doesn't depend on the clock).
 */
export function Year() {
  return useSyncExternalStore(subscribeNever, () => new Date().getFullYear(), () => null);
}
