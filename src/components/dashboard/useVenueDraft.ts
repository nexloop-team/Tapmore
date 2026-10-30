"use client";

import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { leavingHref } from "@/lib/leave-guard";
import type { VenueConfig } from "@/lib/venue/schema";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";

/**
 * The dashboard's sidebar shows the venue's name and logo, rendered by the
 * server; only a change to one of them needs the server's layout again.
 */
function sidebarChanged(before: Partial<VenueConfig>, after: Partial<VenueConfig>): boolean {
  return ("name" in after && after.name !== before.name) || ("branding" in after && after.branding?.logoUrl !== before.branding?.logoUrl);
}

/**
 * Local draft of some top-level sections of a venue's config. Saving sends
 * just those sections; the server merges and validates the whole config.
 * The editor already holds what it saved, so nothing is fetched again
 * afterwards (the phone preview shows the draft live).
 */
export function useVenueDraft<T extends Partial<VenueConfig>>(
  venueId: string,
  initial: T,
  /** Unsaved changes the editor keeps outside the config (the birthday reward), so leaving still asks first. */
  options: { pending?: boolean } = {},
) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compared a beat behind the typing, so a big menu doesn't slow each keystroke.
  const savedJson = useMemo(() => JSON.stringify(saved), [saved]);
  const settledDraft = useDeferredValue(draft);
  const dirty = useMemo(() => savedJson !== JSON.stringify(settledDraft), [savedJson, settledDraft]);

  const unsaved = dirty || !!options.pending;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // A link to another dashboard page (the sidebar, "Edit your menu") would drop the edits without a word:
  // the browser's warning only covers closing the tab. Caught before the link's own handler, then asked.
  const ask = useConfirm();
  useEffect(() => {
    if (!unsaved) return;
    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = leavingHref(event, { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") }, window.location.href);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      void ask({
        title: "Leave without saving?",
        body: "Your changes on this page haven't been saved, and they'll be lost.",
        confirmLabel: "Leave",
        cancelLabel: "Stay",
        danger: true,
      }).then((leave) => {
        if (leave) router.push(href);
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [unsaved, ask, router]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  /** Puts back the version before the last save, keeping this editor's fields in step. */
  const restore = useCallback(async () => {
    try {
      const venue = await dashboardApi.restoreVenue(venueId);
      const config = venue.config ?? {};
      const restored = Object.fromEntries(Object.keys(initial).map((key) => [key, config[key as keyof VenueConfig]])) as T;
      if (sidebarChanged(saved, restored)) router.refresh();
      setSaved(restored);
      setDraft(restored);
      toast({ text: "Undone. Your page is back to how it was." });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
    // `initial` only supplies the field names, which never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, saved, router, toast]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await dashboardApi.updateVenue(venueId, { config: draft });
      if (sidebarChanged(saved, draft)) router.refresh();
      setSaved(draft);
      toast({ text: "Changes saved. They're live on your page.", action: { label: "Undo", onClick: () => void restore() } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [venueId, saved, draft, router, toast, restore]);

  const reset = useCallback(() => {
    setDraft(saved);
    setError(null);
  }, [saved]);

  return { draft, setDraft, update, dirty, saving, error, save, reset };
}
