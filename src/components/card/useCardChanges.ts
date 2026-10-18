"use client";

import { useEffect, useRef } from "react";

export interface CardState {
  stamps: number;
  version: string;
}

/**
 * How long to wait before the next check, `elapsed` ms after the card came
 * into view. Stamps are added while the guest is at the till, usually in the
 * first minute or two: quick checks then, slower ones after, and none once
 * the card has sat open for ten minutes (coming back to the tab starts over).
 */
export function nextCheckDelay(elapsed: number): number | null {
  if (elapsed < 2 * 60_000) return 4_000;
  if (elapsed < 5 * 60_000) return 15_000;
  if (elapsed < 10 * 60_000) return 30_000;
  return null;
}

/**
 * Watches a member's card for changes made at the till (stamps, rewards,
 * birthday treats, undos) with the cheap state check, and calls `onChange`
 * only when something moved. `knownStamps` is what's on screen, so a stamp
 * added just before the first check still counts as a change.
 */
export function useCardChanges({
  cardId,
  token,
  active,
  knownStamps,
  onChange,
  onMissing,
}: {
  cardId: string;
  token: string;
  active: boolean;
  knownStamps: number | null;
  onChange: (state: CardState) => void;
  onMissing?: () => void;
}) {
  // Latest values without restarting the timer on every render.
  const latest = useRef({ knownStamps, onChange, onMissing });
  useEffect(() => {
    latest.current = { knownStamps, onChange, onMissing };
  });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let since = Date.now();
    let version: string | null = null;

    async function check() {
      try {
        const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}/state?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (stopped) return;
        if (response.status === 404) {
          latest.current.onMissing?.();
          return;
        }
        if (response.ok) {
          const state = (await response.json()) as CardState;
          if (stopped) return;
          const known = latest.current.knownStamps;
          const changed = version === null ? known !== null && state.stamps !== known : state.version !== version;
          version = state.version;
          if (changed) latest.current.onChange(state);
        }
      } catch {
        /* offline at the till is fine; the next check tries again */
      }
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      const delay = nextCheckDelay(Date.now() - since);
      if (!stopped && delay !== null && document.visibilityState === "visible") timer = setTimeout(check, delay);
    }

    // Hidden tabs don't check; coming back checks at once and restarts the quick phase.
    function onVisibility() {
      if (document.visibilityState !== "visible") return clearTimeout(timer);
      since = Date.now();
      clearTimeout(timer);
      void check();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, cardId, token]);
}
