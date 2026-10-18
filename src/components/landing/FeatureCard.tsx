"use client";

import { ChevronDown, ChevronRight, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { scrollMotion } from "@/lib/browser";
import { useLanding } from "./LandingContext";

/**
 * 44px tinted circle: the feature colour behind the glyph in full colour. The
 * wash is stronger on dark cards (--icon-soft, set by the theme) so it still reads.
 */
function IconCircle({ tint, children }: { tint: string | null; children: ReactNode }) {
  return (
    <span className={`icon-circle${tint ? "" : " neutral"}`} style={tint ? ({ "--tint": tint } as CSSProperties) : undefined}>
      {children}
    </span>
  );
}

interface RowProps {
  label: string;
  icon: ReactNode;
  tint: string | null;
  /** "down" for cards that expand in place, "right" for cards that go somewhere. */
  chevron?: "down" | "right" | false;
}

function RowContent({ label, icon, tint, chevron = "right" }: RowProps) {
  const Chevron = chevron === "down" ? ChevronDown : ChevronRight;
  return (
    <>
      <IconCircle tint={tint}>{icon}</IconCircle>
      <span className="feature-label">{label}</span>
      {chevron && <Chevron className={`chevron chevron-${chevron}`} aria-hidden strokeWidth={2} />}
    </>
  );
}

/**
 * Grid layout: a bento tile instead of a row. `tone` picks the shade (from
 * the venue's tile palette) and `size` how much of the two-column grid it takes.
 */
export interface TileSpec {
  tone: "hero" | "pop" | "pale";
  size: "wide" | "tall" | "small";
  content: ReactNode;
}

function tileClass(tile: TileSpec): string {
  return `feature-wrapper tile-wrap tile-${tile.tone} tile-${tile.size}`;
}

/**
 * Grid tiles open their content in a bottom sheet rather than inline, so
 * the bento stays in place. Closes on the scrim, the ✕ or Escape, and hands
 * focus back to the tile.
 */
function TileSheet({ open, label, onClose, children }: { open: boolean; label: string; onClose: () => void; children: ReactNode }) {
  const { t } = useLanding();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // Let a field inside (the feedback box) take focus first if it wants it.
    const focusTimer = setTimeout(() => {
      if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true });
    }, 60);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      opener?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <div className={`bottom-sheet tile-sheet${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="bottom-sheet-scrim" onClick={onClose} />
      <div ref={panel} className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="bottom-sheet-handle" aria-hidden />
        <div className="tile-sheet-head">
          <h2 id={titleId}>{label}</h2>
          <button type="button" className="tile-sheet-close" aria-label={t("close")} onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        <div className="tile-sheet-body">{children}</div>
      </div>
    </div>
  );
}

interface SheetControls {
  isOpen: boolean;
  close: () => void;
}

const SheetContext = createContext<SheetControls>({ isOpen: false, close: () => {} });

/** Lets content inside a sheet collapse it (e.g. a success panel's ✕). */
export function useSheet() {
  return useContext(SheetContext);
}

interface ExpandableCardProps extends RowProps {
  feature: string;
  /** Grid layout: show as a tile that opens a bottom sheet. */
  tile?: TileSpec;
  /** Called synchronously inside the tap, so it can grab focus for the iOS keyboard. */
  onToggle?: (open: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  /** A finger or the keyboard is on the card: start fetching the sheet's code before the tap lands. */
  onIntent?: () => void;
  children: ReactNode;
}

/**
 * A card whose row toggles an inline sheet. Sheets are independent: several
 * can be open at once. Opening scrolls the card to the top once the sheet
 * has started to grow. The content mounts on first open and then stays.
 */
export function ExpandableCard({ feature, label, icon, tint, onToggle, onIntent, tile, children }: ExpandableCardProps) {
  const [isOpen, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  const close = useCallback(() => setOpen(false), []);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = !isOpen;
    setOpen(next);
    if (next) setHasOpened(true);
    onToggle?.(next, event);
    if (next && !tile) {
      setTimeout(() => wrapperRef.current?.scrollIntoView({ behavior: scrollMotion(), block: "start" }), 350);
    }
  }

  if (tile) {
    return (
      <div className={tileClass(tile)} data-feature={feature}>
        <button type="button" className="tile" aria-haspopup="dialog" aria-expanded={isOpen} onClick={toggle} onPointerDown={onIntent} onFocus={onIntent}>
          {tile.content}
        </button>
        <TileSheet open={isOpen} label={label} onClose={close}>
          <SheetContext.Provider value={{ isOpen, close }}>{hasOpened && children}</SheetContext.Provider>
        </TileSheet>
      </div>
    );
  }

  return (
    <div className="feature-wrapper" ref={wrapperRef} data-feature={feature}>
      <button type="button" className="feature-card" aria-expanded={isOpen} aria-controls={sheetId} onClick={toggle} onPointerDown={onIntent} onFocus={onIntent}>
        <RowContent label={label} icon={icon} tint={tint} chevron="down" />
      </button>
      <section id={sheetId} className={`sheet${isOpen ? " open" : ""}`} aria-label={label} inert={!isOpen}>
        <div className="sheet-clip">
          <SheetContext.Provider value={{ isOpen, close }}>{hasOpened && children}</SheetContext.Provider>
        </div>
      </section>
    </div>
  );
}

/** A card that does something immediately (navigate, open a link) instead of expanding. */
export function ActionCard({ feature, onActivate, tile, ...row }: RowProps & { feature: string; onActivate: () => void; tile?: TileSpec }) {
  if (tile) {
    return (
      <div className={tileClass(tile)} data-feature={feature}>
        <button type="button" className="tile" onClick={onActivate} aria-label={row.label}>
          {tile.content}
        </button>
      </div>
    );
  }
  return (
    <div className="feature-wrapper" data-feature={feature}>
      <button type="button" className="feature-card" onClick={onActivate}>
        <RowContent {...row} />
      </button>
    </div>
  );
}

/** A merchant's custom link: a real anchor, opened in a new tab, no chevron. */
export function LinkCard({ href, onClick, tile, ...row }: RowProps & { href: string; onClick: () => void; tile?: TileSpec }) {
  if (tile) {
    return (
      <div className={tileClass(tile)} data-feature="link">
        <a className="tile" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
          {tile.content}
        </a>
      </div>
    );
  }
  return (
    <div className="feature-wrapper" data-feature="link">
      <a className="feature-card" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <RowContent {...row} chevron={false} />
      </a>
    </div>
  );
}
