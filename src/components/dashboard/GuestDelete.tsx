"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";

/** Erases one guest, for when they ask you to delete their data. */
export function GuestDelete({ venueId, customerId, email }: { venueId: string; customerId: string; email: string }) {
  const router = useRouter();
  const ask = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const ok = await ask({
      title: `Delete ${email}?`,
      body: "Their details, card, stamps and visit history are erased for good. Use this when a guest asks you to delete their data.",
      confirmLabel: "Delete guest",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await dashboardApi.deleteGuest(venueId, customerId);
      router.refresh();
    } catch (error) {
      toast({ text: errorMessage(error), tone: "error" });
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={remove} disabled={busy} aria-label={`Delete ${email}`} title="Delete guest">
      {busy ? <Loader2 className="spin" aria-hidden /> : <Trash2 aria-hidden />}
    </button>
  );
}
