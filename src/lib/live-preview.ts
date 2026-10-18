"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live preview between the guest page editor and the preview frame: the
 * editor posts its unsaved draft, the guest page (in preview mode only)
 * shows it straight away. Same-origin messages only, and nothing is saved:
 * a draft only changes what this one preview frame displays.
 */

const DRAFT = "tapmore:draft";
const READY = "tapmore:preview-ready";

/**
 * Editor side: send the draft to every live preview frame, and to any frame
 * that loads later. Fast typing is sent once per frame at most, so a big
 * menu re-renders in the phone as often as the screen can show it, no more.
 */
export function useLivePreview(draft: unknown) {
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
    const frameId = requestAnimationFrame(() => {
      for (const frame of document.querySelectorAll<HTMLIFrameElement>("iframe[data-live-preview]")) {
        frame.contentWindow?.postMessage({ type: DRAFT, draft }, window.location.origin);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [draft]);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== READY) return;
      (event.source as Window | null)?.postMessage({ type: DRAFT, draft: latest.current }, window.location.origin);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}

/** Preview side: the latest draft from the editor, or null outside a preview frame. */
export function usePreviewDraft<T>(enabled: boolean): T | null {
  const [draft, setDraft] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled || window.parent === window) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== DRAFT) return;
      setDraft(event.data.draft as T);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled]);
  return draft;
}
