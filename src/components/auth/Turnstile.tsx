"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const ORIGIN = "https://challenges.cloudflare.com";

/** Whether forms must wait for the check (no site key, no check). */
export const captchaEnabled = !!SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render(
        element: HTMLElement,
        options: { sitekey: string; theme?: "auto" | "light" | "dark"; callback?: () => void; "expired-callback"?: () => void; "error-callback"?: () => void },
      ): string;
      reset(widgetId?: string): void;
      remove(widgetId: string): void;
    };
  }
}

/**
 * Cloudflare Turnstile, rendered explicitly so it survives client-side
 * navigation. It adds a hidden `cf-turnstile-response` field to the
 * surrounding form, and reports when it's solved (or expires), so the form
 * can wait for it rather than fail. The connection to Cloudflare is opened
 * from the server-rendered page, before the script is asked for. Renders
 * nothing when no site key is configured.
 */
export function Turnstile({ onSolved }: { onSolved?: (solved: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const report = useRef(onSolved);
  useEffect(() => {
    report.current = onSolved;
  });
  if (SITE_KEY) preconnect(ORIGIN);

  useEffect(() => {
    if (!SITE_KEY || !ready || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      theme: "auto",
      callback: () => report.current?.(true),
      "expired-callback": () => report.current?.(false),
      "error-callback": () => report.current?.(false),
    });
    return () => window.turnstile?.remove(id);
  }, [ready]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script src={`${ORIGIN}/turnstile/v0/api.js?render=explicit`} onReady={() => setReady(true)} />
      <div ref={container} style={{ marginTop: 16, minHeight: 65 }} />
    </>
  );
}

/** Tokens are single-use, so a failed submit needs a fresh challenge. */
export function resetTurnstile() {
  window.turnstile?.reset();
}

export function captchaToken(form: FormData): string | undefined {
  return String(form.get("cf-turnstile-response") ?? "") || undefined;
}
