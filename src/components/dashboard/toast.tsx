"use client";

import { AlertCircle, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastOptions {
  text: string;
  /** One follow-up, e.g. "Undo". The toast closes when it's used. */
  action?: { label: string; onClick: () => void };
  /** How long it stays up; long enough to reach an action. Paused while the pointer or focus is on it. */
  durationMs?: number;
  /** "error": something didn't work (a different icon and colour, not a tick). */
  tone?: "ok" | "error";
}

type ShowToast = (options: ToastOptions) => void;

// Outside a provider (e.g. onboarding) toasts are simply dropped.
const ToastContext = createContext<ShowToast>(() => {});

/** "Saved", "Restored" and friends: one at a time, bottom of the screen, announced to screen readers. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The showing toast's time left, and when that count started (null while paused). */
  const clock = useRef<{ id: number; left: number; since: number | null } | null>(null);

  const run = useCallback((id: number, ms: number) => {
    clearTimeout(timer.current);
    clock.current = { id, left: ms, since: Date.now() };
    timer.current = setTimeout(() => setToast((current) => (current?.id === id ? null : current)), ms);
  }, []);

  const show = useCallback<ShowToast>(
    (options) => {
      const id = Date.now();
      setToast({ ...options, id });
      run(id, options.durationMs ?? (options.action ? 8000 : options.tone === "error" ? 6000 : 3500));
    },
    [run],
  );

  // Reading it (pointer over it, or keyboard focus inside it) holds it on screen.
  const pause = useCallback(() => {
    const c = clock.current;
    if (!c || c.since === null) return;
    clearTimeout(timer.current);
    clock.current = { ...c, left: Math.max(1500, c.left - (Date.now() - c.since)), since: null };
  }, []);
  const resume = useCallback(() => {
    const c = clock.current;
    if (c && c.since === null) run(c.id, c.left);
  }, [run]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast${toast.tone === "error" ? " toast-error" : ""}`} onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}>
            {toast.tone === "error" ? <AlertCircle aria-hidden className="toast-icon" /> : <Check aria-hidden className="toast-icon" />}
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
              <X aria-hidden />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
