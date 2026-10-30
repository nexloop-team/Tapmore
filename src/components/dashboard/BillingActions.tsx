"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { preload } from "react-dom";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Subscribe (Razorpay Checkout in a pop-up, or straight on in dev mode). */
export function SubscribeButton({ venueId, label, variant = "primary" }: { venueId: string; label: string; variant?: "primary" | "light" }) {
  // Fetched while the owner reads the page, so the payment window opens without a wait.
  preload(CHECKOUT_SCRIPT, { as: "script" });
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billingPage = `/dashboard/${venueId}/billing`;

  async function go() {
    setPending(true);
    setError(null);
    try {
      const start = await dashboardApi.checkout(venueId);
      if (start.kind === "redirect") {
        window.location.assign(start.url);
        return;
      }
      if (!(await loadCheckout()) || !window.Razorpay) {
        // Blocked script (an ad blocker, say): Razorpay's hosted page does the same job.
        if (start.fallbackUrl) window.location.assign(start.fallbackUrl);
        else throw new Error("The payment window couldn't load. Check your connection and try again.");
        return;
      }
      const checkout = new window.Razorpay({
        key: start.keyId,
        subscription_id: start.subscriptionId,
        name: start.name,
        description: start.description,
        prefill: start.prefill,
        handler: async (response: RazorpayResponse) => {
          try {
            await dashboardApi.confirmPayment(venueId, {
              paymentId: response.razorpay_payment_id,
              subscriptionId: response.razorpay_subscription_id,
              signature: response.razorpay_signature,
            });
            router.push(`${billingPage}?subscribed=1`);
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
            setPending(false);
          }
        },
        modal: { ondismiss: () => setPending(false) },
      });
      checkout.open();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className={variant === "light" ? "btn btn-block plan-subscribe" : "btn btn-primary"} onClick={go} disabled={pending}>
        {pending && <Loader2 className="spin" aria-hidden />}
        {label}
      </button>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

/** Stops renewal at the end of the paid year (dev mode: straight away). */
export function CancelSubscriptionButton({ venueId, endsOn, devMode }: { venueId: string; endsOn: string | null; devMode: boolean }) {
  const router = useRouter();
  const ask = useConfirm();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    const ok = await ask({
      title: "Cancel your subscription?",
      body: devMode
        ? "Dev mode: it ends straight away and your page goes offline."
        : `It won't renew. Your page stays live${endsOn ? ` until ${endsOn}` : " until the end of the year you paid for"}, then goes offline. Your settings are kept.`,
      confirmLabel: "Cancel subscription",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    try {
      await dashboardApi.cancelSubscription(venueId);
      toast({ text: devMode ? "Subscription ended." : "Your subscription won't renew." });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={go} disabled={pending}>
        {pending && <Loader2 className="spin" aria-hidden />}
        Cancel subscription
      </button>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
