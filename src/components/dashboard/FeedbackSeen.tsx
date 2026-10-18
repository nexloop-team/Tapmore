"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The sidebar's unread count, cleared on screen once the inbox has been
 * read, without fetching the layout again. A small store rather than an
 * event, so it doesn't matter whether the inbox or the sidebar renders first
 * (on a full page load the page's effects run before the layout's).
 */

/** Venue id → the unread count the inbox showed when it was read. */
let readUpTo: Record<string, number> = {};
const listeners = new Set<() => void>();
const EMPTY: Record<string, number> = {};

function publish(next: Record<string, number>) {
  readUpTo = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read inboxes, for the sidebar. */
export function useReadInboxes(): Record<string, number> {
  return useSyncExternalStore(subscribe, () => readUpTo, () => EMPTY);
}

/** The server's count caught up (it reads 0): nothing left to hide for this venue. */
export function forgetReadInbox(venueId: string) {
  if (venueId in readUpTo) publish(Object.fromEntries(Object.entries(readUpTo).filter(([id]) => id !== venueId)));
}

/** Rendered by the inbox: everything up to `count` notes is read now. */
export function FeedbackSeen({ venueId, count }: { venueId: string; count: number }) {
  useEffect(() => {
    if (count > 0) publish({ ...readUpTo, [venueId]: Math.max(count, readUpTo[venueId] ?? 0) });
  }, [venueId, count]);
  return null;
}
