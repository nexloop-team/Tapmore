"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, ApiRequestError } from "@/lib/api/client";
import { deviceMemory, parseCardCredentials, subscribeStorage } from "@/lib/browser";
import { wifiGateActive } from "@/lib/venue/features";
import { useSheet } from "../FeatureCard";
import { useLanding } from "../LandingContext";
import { WifiCredentials } from "./WifiCredentials";
import { WifiGate, type GateCompletion } from "./WifiGate";

export function WifiSheet() {
  const { venue, track, knownCustomerId } = useLanding();
  const { isOpen } = useSheet();
  const gated = wifiGateActive(venue);
  const [completion, setCompletion] = useState<GateCompletion | null>(null);
  const visitRecorded = useRef(false);
  const wasOpen = useRef(false);

  // A loyalty member whose card is on this phone is already known: no email asked.
  const storedCardRaw = useSyncExternalStore(subscribeStorage, () => deviceMemory.cardRaw(venue.id), () => null);
  const [refusedCardId, setRefusedCardId] = useState<string | null>(null);
  const card = useMemo(() => {
    const stored = parseCardCredentials(storedCardRaw);
    return stored && stored.cardId !== refusedCardId ? stored : null;
  }, [storedCardRaw, refusedCardId]);

  // Who this phone is: the id from the gate (or a join elsewhere on the page), else the card it holds.
  const customerId = completion?.customerId ?? knownCustomerId;
  const guest = useMemo(
    () => (customerId ? { key: customerId, proof: { customerId } } : card ? { key: card.cardId, proof: { card } } : null),
    [customerId, card],
  );
  const gateVisible = gated && !guest;

  // Behind the gate the password is fetched once the guest is known.
  const [password, setPassword] = useState<{ for: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!gated || !isOpen || !guest || password?.for === guest.key) return;
    let cancelled = false;
    api
      .wifiPassword({ venueId: venue.id, ...guest.proof })
      .then((result) => !cancelled && setPassword({ for: guest.key, value: result.password }))
      .catch((error) => {
        if (cancelled) return;
        // A card the venue no longer has (deleted, or reset): ask for the email after all.
        if ("card" in guest.proof && error instanceof ApiRequestError && error.status === 404) setRefusedCardId(guest.key);
        else setPassword({ for: guest.key, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [gated, isOpen, guest, password, venue.id]);

  // Open/close is what's measured: a tap, not a page load.
  useEffect(() => {
    if (isOpen === wasOpen.current) return;
    wasOpen.current = isOpen;
    if (!isOpen) {
      if (gateVisible) track("wifi_gate_abandoned");
      return;
    }
    track("wifi_sheet_opened");
    if (gateVisible) {
      track("wifi_gate_shown");
      return;
    }
    // A guest this phone knows counts as a visit, for the owner's guest list.
    if (guest && !completion && !visitRecorded.current) {
      visitRecorded.current = true;
      track("wifi_known_device_connected");
      void api.recordVisit({ venueId: venue.id, ...guest.proof, type: "wifi_tap" }).catch(() => {});
    }
  }, [isOpen, gateVisible, guest, completion, venue.id, track]);

  function complete(result: GateCompletion) {
    visitRecorded.current = true; // the capture itself recorded this visit
    setCompletion(result);
    track("wifi_gate_completed");
  }

  return (
    <div className="sheet-inner">
      {gateVisible ? (
        <WifiGate onComplete={complete} />
      ) : (
        <>
          <WifiCredentials gated={gated} password={gated && password && password.for === guest?.key ? password.value : undefined} />
        </>
      )}
    </div>
  );
}
