"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useLanding } from "./LandingContext";

/**
 * A sheet whose code downloads after the page instead of with it, so the
 * first screen stays light on slow phones. `preload()` fetches it ahead of
 * time (idle time, or the moment a finger lands on the card); once loaded it
 * renders synchronously, so opening a sheet doesn't flash a spinner.
 */
function lazySheet<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  function preload(): Promise<ComponentType<P>> {
    pending ??= load().then(
      (component) => (loaded = component),
      (error: unknown) => {
        // Offline or a failed chunk: the next attempt starts over.
        pending = null;
        throw error;
      },
    );
    return pending;
  }

  function Sheet(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => loaded);
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (Component) return;
      let live = true;
      preload().then(
        (component) => live && setComponent(() => component),
        () => live && setFailed(true),
      );
      return () => {
        live = false;
      };
    }, [Component, attempt]);

    if (Component) return <Component {...props} />;
    return <SheetPlaceholder failed={failed} onRetry={() => (setFailed(false), setAttempt((n) => n + 1))} />;
  }

  return Object.assign(Sheet, {
    /** Starts the download; a failure is retried when the sheet opens. */
    preload: () => void preload().catch(() => {}),
    load: preload,
  });
}

function SheetPlaceholder({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useLanding();
  if (failed) {
    return (
      <div className="sheet-inner sheet-loading" role="alert">
        <p>{t("something_wrong")}</p>
        <button type="button" className="sheet-retry" onClick={onRetry}>
          {t("try_again")}
        </button>
      </div>
    );
  }
  return (
    <div className="sheet-inner sheet-loading" role="status" aria-busy="true">
      <span className="spinner" aria-hidden />
    </div>
  );
}

export const LoyaltySheet = lazySheet(() => import("./loyalty/LoyaltySheet").then((m) => m.LoyaltySheet));
export const RewardsSheet = lazySheet(() => import("./loyalty/RewardsJoinForm").then((m) => m.RewardsSheet));
export const MyCard = lazySheet(() => import("./loyalty/MyCard").then((m) => m.MyCard));
export const WifiSheet = lazySheet(() => import("./wifi/WifiSheet").then((m) => m.WifiSheet));
export const FeedbackSheet = lazySheet(() => import("./feedback/FeedbackSheet").then((m) => m.FeedbackSheet));
export const SudokuSheet = lazySheet(() => import("./sudoku/SudokuSheet").then((m) => m.SudokuSheet));

/**
 * Fetches the sheets this page shows once the browser is idle, most likely
 * first. Skipped when the guest asked their browser to save data: then each
 * sheet loads when its card is touched.
 */
export function preloadSheetsWhenIdle(sheets: { load: () => Promise<unknown> }[]): () => void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData || sheets.length === 0) return () => {};
  let cancelled = false;
  const next = (index: number) => {
    if (cancelled || index >= sheets.length) return;
    sheets[index].load().then(
      () => schedule(() => next(index + 1)),
      () => {},
    );
  };
  // Safari has no requestIdleCallback.
  const schedule = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200));
  schedule(() => next(0));
  return () => {
    cancelled = true;
  };
}
