"use client";

import { QrCode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deviceMemory, storageWorks, subscribeNever } from "@/lib/browser";
import { useCardChanges } from "./useCardChanges";

/**
 * The member card's live part: the "Show to staff" code, and a quiet check
 * that notices stamps added at the till and refreshes the card with a toast.
 */
export function CardLive({
  venueId,
  cardId,
  token,
  stamps,
  qrSvg,
  code,
  labels,
}: {
  venueId: string;
  cardId: string;
  token: string;
  stamps: number;
  /** Server-generated QR for staff; null when the venue has no stamp card. */
  qrSvg: string | null;
  /** The short card code printed under the QR, for staff who type it in. */
  code: string;
  labels: { title: string; show: string; hide: string; hint: string; added: string; redeemed: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const known = useRef(stamps);

  useEffect(() => {
    known.current = stamps;
  }, [stamps]);

  // Opening the emailed link teaches this phone the card, so the venue's
  // own page shows it from now on instead of the join form.
  useEffect(() => deviceMemory.rememberCard(venueId, { cardId, token }), [venueId, cardId, token]);

  useCardChanges({
    cardId,
    token,
    active: !!qrSvg,
    knownStamps: stamps,
    onChange: ({ stamps: latest }) => {
      const diff = latest - known.current;
      known.current = latest;
      if (diff !== 0) {
        setToast(diff > 0 ? labels.added.replace("{count}", String(diff)) : labels.redeemed);
        setTimeout(() => setToast(null), 4000);
      }
      router.refresh();
    },
  });

  if (!qrSvg) return null;
  return (
    <section className="rc-staff">
      {toast && (
        <div className="card-toast" role="status">
          {toast}
        </div>
      )}
      <h2>{labels.title}</h2>
      {open ? (
        <>
          <div className="rc-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="rc-qr-code">{code}</p>
          <p className="rc-qr-hint">{labels.hint}</p>
          <button type="button" className="card-staff-btn secondary" onClick={() => setOpen(false)}>
            {labels.hide}
          </button>
        </>
      ) : (
        <button type="button" className="card-staff-btn" onClick={() => setOpen(true)}>
          <QrCode aria-hidden />
          {labels.show}
        </button>
      )}
    </section>
  );
}

/** "Not Maya? Use a different card": forget this card on this phone and go back to the venue's page to join or open another. */
export function DifferentCard({ venueId, shortCode, label }: { venueId: string; shortCode: string; label: string }) {
  return (
    <p className="rc-different">
      <Link href={`/s?i=${encodeURIComponent(shortCode)}`} onClick={() => deviceMemory.forgetCard(venueId)}>
        {label}
      </Link>
    </p>
  );
}

/**
 * The member erases their own card and details (DPDP: withdrawing consent is
 * as easy as giving it). The card's private link is the proof it's theirs.
 */
export function DeleteMyCard({
  venueId,
  shortCode,
  cardId,
  token,
  labels,
  onDeleted,
}: {
  venueId: string;
  shortCode: string;
  cardId: string;
  token: string;
  labels: { action: string; confirm: string; done: string; failed: string };
  /** On the venue's own page: called a moment after the confirmation shows, to put the join form back. */
  onDeleted?: () => void;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  async function remove() {
    if (!window.confirm(labels.confirm)) return;
    setState("busy");
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}?t=${encodeURIComponent(token)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      deviceMemory.forgetCard(venueId);
      setState("done");
      if (onDeleted) setTimeout(onDeleted, 3000);
    } catch {
      setState("failed");
    }
  }

  if (state === "done") {
    if (onDeleted) {
      return (
        <p className="rc-different" role="status">
          {labels.done}
        </p>
      );
    }
    return (
      <p className="rc-different" role="status">
        {labels.done} <Link href={`/s?i=${encodeURIComponent(shortCode)}`}>{shortCode}</Link>
      </p>
    );
  }
  return (
    <p className="rc-different">
      <button type="button" className="link-btn" onClick={remove} disabled={state === "busy"}>
        {labels.action}
      </button>
      {state === "failed" && <span role="alert"> · {labels.failed}</span>}
    </p>
  );
}

/**
 * The card link from an email: this phone learns the card, then the guest
 * lands on the venue's own page, where the card now sits in place of the join
 * form. If the browser can't keep it (storage blocked), the full card page
 * stays on screen instead, so the guest is never left without their card.
 */
export function OpenOnVenuePage({
  venueId,
  shortCode,
  cardId,
  token,
  opening,
  children,
}: {
  venueId: string;
  shortCode: string;
  cardId: string;
  token: string;
  opening: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // null while server-rendering; then whether this browser can keep the card.
  const canKeep = useSyncExternalStore(subscribeNever, storageWorks, () => null);
  const stay = canKeep === false;

  useEffect(() => {
    if (!canKeep) return;
    deviceMemory.rememberCard(venueId, { cardId, token });
    router.replace(`/s?i=${encodeURIComponent(shortCode)}`);
  }, [canKeep, venueId, shortCode, cardId, token, router]);

  return (
    <>
      {!stay && (
        <p className="rc-opening" role="status">
          {opening}
        </p>
      )}
      <div hidden={!stay}>{children}</div>
    </>
  );
}
