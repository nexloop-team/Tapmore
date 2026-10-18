"use client";

import { useOffline } from "next/offline";
import { useTillQueue } from "./till-queue";

/**
 * "Online" with a green dot, or "Offline" when the till can't reach us (the
 * browser's own signal, or a request that failed: a dead Wi-Fi behind a
 * working one counts too), with how many actions are waiting to be sent.
 */
export function OnlineStatus() {
  const offline = useOffline();
  const { waiting } = useTillQueue();
  const label = offline ? "Offline" : waiting.length > 0 ? "Sending…" : "Online";
  return (
    <span className={`till-paired${offline ? " offline" : ""}`} role="status">
      <span aria-hidden /> {label}
      {waiting.length > 0 && ` · ${waiting.length} waiting`}
    </span>
  );
}
