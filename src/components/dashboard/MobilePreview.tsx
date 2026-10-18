"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * On phones and small tablets the side-by-side preview doesn't fit, so this
 * button opens the saved page full screen without leaving the editor.
 */
export function MobilePreview({ src, label, dirty }: { src: string; label: string; dirty: boolean }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Everything behind the dialog is inert while it's open, so Tab stays inside it.
    const behind = [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== dialog.current && !el.inert);
    for (const el of behind) el.inert = true;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = scroll;
      for (const el of behind) el.inert = false;
      document.removeEventListener("keydown", onKey);
      // Back to the button that opened it.
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn mobile-preview-btn" onClick={() => setOpen(true)}>
        <Eye aria-hidden /> {label}
      </button>
      {open &&
        // At the page root: a transformed ancestor would otherwise shift a fixed overlay.
        createPortal(
          <div ref={dialog} className="app mobile-preview" role="dialog" aria-modal="true" aria-label={label}>
            <div className="mobile-preview-bar">
              <span>{dirty ? "Showing your unsaved changes. Save to put them live." : "This is what guests see."}</span>
              <button ref={closeButton} type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                <X aria-hidden /> Close
              </button>
            </div>
            <iframe data-live-preview src={src} title={label} />
          </div>,
          document.body,
        )}
    </>
  );
}
