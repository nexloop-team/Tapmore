"use client";

import { ExternalLink } from "lucide-react";
import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

/**
 * The frame shared by the guest-experience editors: a row of section tabs
 * over the settings, and a phone on the right showing the unsaved draft.
 */

export interface EditorTab {
  id: string;
  label: string;
  /** Older links (/design#wifi) that should open this tab. */
  anchors?: string[];
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The open tab lives in the URL hash, so links like /design#wifi open the right one and a refresh stays put. */
export function useEditorTab(tabs: EditorTab[]): [string, (id: string) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => decodeURIComponent(window.location.hash.slice(1)),
    () => "",
  );
  const active = tabs.find((tab) => tab.id === hash || tab.anchors?.includes(hash))?.id ?? tabs[0]?.id ?? "";
  function select(id: string) {
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return [active, select];
}

export function EditorTabs({ tabs, active, onSelect, label }: { tabs: EditorTab[]; active: string; onSelect: (id: string) => void; label: string }) {
  const list = useRef<HTMLDivElement>(null);
  // Arrow keys move between tabs, as screen-reader users expect.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onSelect(next.id);
    list.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  }
  return (
    <div ref={list} className="editor-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          data-tab={tab.id}
          id={`tab-${tab.id}`}
          aria-selected={tab.id === active}
          aria-controls={`panel-${tab.id}`}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function EditorPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="editor-panel" role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

/** The phone on the right. Frames marked data-live-preview get the editor's draft (see lib/live-preview). */
export function PreviewPane({ src, title, fullHref }: { src: string; title: string; fullHref: string }) {
  return (
    <aside className="preview-pane" aria-label={title}>
      <span className="preview-label">Live preview</span>
      <div className="phone">
        <div className="phone-screen">
          {/* Loaded once: saves and edits reach it as messages, so it never flashes white. */}
          <iframe data-live-preview src={src} title={title} />
        </div>
      </div>
      <p className="hint preview-foot">
        <span>Changes show straight away</span>
        <a href={fullHref} target="_blank" rel="noreferrer">
          Full size <ExternalLink aria-hidden />
        </a>
      </p>
    </aside>
  );
}
