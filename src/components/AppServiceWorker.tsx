"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Registers the app's service worker (app/sw.js) for one part of the site,
 * "/dashboard" or "/staff", never the guest pages. A till can stay open for
 * days, so it checks for a new version every half hour; when one is ready
 * it says so and reloads only when asked, never in the middle of a stamp.
 */
export function AppServiceWorker({ scope }: { scope: "/dashboard" | "/staff" }) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadAsked = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    const offer = (worker: ServiceWorker | null) => worker && navigator.serviceWorker.controller && setWaiting(worker);
    navigator.serviceWorker
      .register("/sw.js", { scope })
      .then((reg) => {
        registration = reg;
        offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => worker.state === "installed" && offer(worker));
        });
      })
      .catch(() => {
        /* no service worker: the app works the same, just without the offline page */
      });
    const check = setInterval(() => registration?.update().catch(() => {}), 30 * 60_000);
    const onTakeOver = () => {
      if (reloadAsked.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onTakeOver);
    return () => {
      clearInterval(check);
      navigator.serviceWorker.removeEventListener("controllerchange", onTakeOver);
    };
  }, [scope]);

  if (!waiting) return null;
  return (
    <div className="app-update" role="status">
      <span>A new version is ready.</span>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => {
          reloadAsked.current = true;
          waiting.postMessage("skip-waiting");
        }}
      >
        <RefreshCw aria-hidden /> Reload
      </button>
    </div>
  );
}
