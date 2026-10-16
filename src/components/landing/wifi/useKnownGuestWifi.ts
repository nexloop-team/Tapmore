"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { CardCredentials } from "@/lib/browser";
import { wifiGateActive } from "@/lib/venue/features";
import { useLanding } from "../LandingContext";

/**
 * Behind the Wi-Fi email gate, a guest this phone already knows (a card
 * member, or someone who passed the gate before) needs no form. The password
 * is fetched when the page opens, so a tap on the tile can copy it at once:
 * iPhones only allow copying during the tap itself, not after a request.
 */
export function useKnownGuestWifi(card: CardCredentials | null) {
  const { venue, knownCustomerId } = useLanding();
  const gated = wifiGateActive(venue);
  const guest = useMemo(
    () => (knownCustomerId ? { key: knownCustomerId, proof: { customerId: knownCustomerId } } : card ? { key: card.cardId, proof: { card } } : null),
    [knownCustomerId, card],
  );
  const [fetched, setFetched] = useState<{ for: string; password: string | null } | null>(null);

  useEffect(() => {
    if (!gated || !guest || fetched?.for === guest.key) return;
    let cancelled = false;
    api
      .wifiPassword({ venueId: venue.id, ...guest.proof })
      .then((result) => !cancelled && setFetched({ for: guest.key, password: result.password }))
      .catch(() => !cancelled && setFetched({ for: guest.key, password: null }));
    return () => {
      cancelled = true;
    };
  }, [gated, guest, fetched, venue.id]);

  const recordVisit = useCallback(() => {
    if (guest) void api.recordVisit({ venueId: venue.id, ...guest.proof, type: "wifi_tap" }).catch(() => {});
  }, [guest, venue.id]);

  return { password: guest && fetched?.for === guest.key ? fetched.password : null, recordVisit };
}
