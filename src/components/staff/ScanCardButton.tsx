"use client";

import { Camera, Loader2, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useShowCard } from "./till-card";

/** A member card's staff code: `…/staff/stamp?c=crd_…`. */
function cardIdFromQr(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    const id = url.pathname === "/staff/stamp" ? url.searchParams.get("c") : null;
    return id && /^crd_[A-Za-z0-9]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const SCAN_WIDTH = 640;
const SCAN_EVERY_MS = 150;

type Reader = (video: HTMLVideoElement) => Promise<string | null>;

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = (new (options: { formats: string[] }) => NativeBarcodeDetector) & { getSupportedFormats(): Promise<string[]> };

/**
 * The phone's own QR reader when it has one (Android Chrome: fast, and easy
 * on the battery); otherwise jsQR, downloaded only now that the camera is
 * open, reading a scaled-down frame.
 */
async function qrReader(): Promise<Reader> {
  const Native = (window as Window & { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      /* fall through to jsQR */
    }
  }
  const jsQR = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context) return null;
    const scale = Math.min(1, SCAN_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

/**
 * Scans a guest's card code with the device camera, right in the staff page,
 * so staff never leave it for the camera app. The card it finds opens on the
 * till straight away ("Opening card…" while it loads), with no page load.
 */
export function ScanCardButton({ label = "Scan a card", variant = "primary" }: { label?: string; variant?: "hero" | "primary" | "secondary" }) {
  const router = useRouter();
  const showCard = useShowCard();
  const [open, setOpen] = useState(false);
  /** Bumped to start the camera again after a card couldn't be opened. */
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState(false);
  /** The card couldn't be opened (another venue's, deleted, offline): offer to scan again. */
  const [cardFailed, setCardFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setOpening(false);
  }, [stop]);

  // Escape closes, and focus starts on Close so a keyboard or switch user can leave.
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const found = useCallback(
    async (cardId: string) => {
      navigator.vibrate?.(60);
      stop();
      if (!showCard) {
        setOpen(false);
        router.push(`/staff/stamp?c=${cardId}`);
        return;
      }
      setOpening(true);
      setMessage("Opening card…");
      try {
        const card = await dashboardApi.staffCard(cardId);
        setOpen(false);
        setOpening(false);
        showCard(card);
      } catch (error) {
        setOpening(false);
        setCardFailed(true);
        setMessage(errorMessage(error));
      }
    },
    [router, showCard, stop],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let lastScan = 0;
    let reading = false;

    async function start() {
      setMessage("Point the camera at the guest's card code.");
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser can't use the camera here. Use the phone's camera app, or find the guest by name below.");
        return;
      }
      try {
        const [media, read] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }), qrReader()]);
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        const element = video.current!;
        element.srcObject = media;
        await element.play();
        tick(read);
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setMessage(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in the browser settings, then try again."
            : "We couldn't open the camera. Use the phone's camera app, or find the guest by name below.",
        );
      }
    }

    function tick(read: Reader) {
      frame.current = requestAnimationFrame(() => tick(read));
      const element = video.current;
      const now = performance.now();
      if (reading || !element || element.readyState < 2 || now - lastScan < SCAN_EVERY_MS) return;
      lastScan = now;
      reading = true;
      read(element)
        .then((text) => {
          if (cancelled || !text) return;
          const cardId = cardIdFromQr(text);
          if (!cardId) return setMessage("That's not a member card code. Ask the guest to tap “Show to staff” on their card.");
          cancelled = true;
          void found(cardId);
        })
        .catch(() => {})
        .finally(() => {
          reading = false;
        });
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, attempt, found, stop]);

  return (
    <>
      <button
        type="button"
        className={`staff-btn staff-btn-${variant}`}
        onClick={() => {
          setOpening(false);
          setCardFailed(false);
          setOpen(true);
        }}
      >
        {variant === "hero" ? <ScanLine aria-hidden strokeWidth={1.7} /> : <Camera aria-hidden />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="scanner" role="dialog" aria-modal="true" aria-label="Scan a card">
          <video ref={video} className="scanner-video" playsInline muted />
          <div className="scanner-frame" aria-hidden />
          <p className="scanner-message" role="status">
            {opening && <Loader2 className="spin" aria-hidden />} {message}
          </p>
          {cardFailed && (
            <button
              type="button"
              className="btn scanner-again"
              onClick={() => {
                setCardFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              <Camera aria-hidden /> Scan again
            </button>
          )}
          <button ref={closeButton} type="button" className="btn scanner-close" onClick={close}>
            <X aria-hidden /> Close
          </button>
        </div>
      )}
    </>
  );
}
