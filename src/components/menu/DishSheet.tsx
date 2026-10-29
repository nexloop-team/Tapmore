"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { safeImageUrl } from "@/lib/venue/features";
import type { MenuItem } from "@/lib/venue/types";

interface DishSheetLabels {
  close: string;
  whatsThis: string;
  explainerNote: string;
  soldOut: string;
}

/**
 * Everything about one dish in a bottom sheet: the big photo, the full
 * description, tags, allergens and the "What's this?" note. Closes on the
 * scrim, the ✕ or Escape, and hands focus back to the row that opened it.
 */
export function DishSheet({
  item,
  price,
  tags,
  details,
  labels,
  action,
  onClose,
}: {
  item: MenuItem | null;
  price: string;
  tags: ReactNode;
  /** Allergens and kcal, already worded. */
  details: string[];
  labels: DishSheetLabels;
  /** Under the details: "Ask on WhatsApp" for a product or service. */
  action?: ReactNode;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      opener?.focus();
    };
  }, [open, onClose]);

  const image = item ? safeImageUrl(item.imageUrl) : null;
  const explainer = item?.explainer?.trim();

  return (
    <div className={`bottom-sheet${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="bottom-sheet-scrim" onClick={onClose} />
      <div className="bottom-sheet-panel dish-sheet" role="dialog" aria-modal="true" aria-labelledby="dish-sheet-title">
        {item && (
          <>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant image on any host
              <img className="dish-sheet-photo" src={image} alt="" />
            ) : (
              <div className="bottom-sheet-handle" aria-hidden />
            )}
            <button ref={closeButton} type="button" className="dish-sheet-close" aria-label={labels.close} onClick={onClose}>
              <X aria-hidden />
            </button>
            <div className="dish-sheet-body">
              <div className="dish-sheet-head">
                <h2 id="dish-sheet-title">{item.name}</h2>
                <span className="menu-price">{price}</span>
              </div>
              {!item.isAvailable && <span className="menu-tag sold-out">{labels.soldOut}</span>}
              {item.description && <p className="dish-sheet-desc">{item.description}</p>}
              {tags}
              {details.map((line) => (
                <p key={line} className="menu-allergens">
                  {line}
                </p>
              ))}
              {explainer && (
                <section className="dish-sheet-explainer">
                  <h3>
                    <Info aria-hidden /> {labels.whatsThis}
                  </h3>
                  <p>{explainer}</p>
                  <p className="menu-explainer-note">{labels.explainerNote}</p>
                </section>
              )}
              {action}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
