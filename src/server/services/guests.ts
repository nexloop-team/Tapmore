import "server-only";
import type { z } from "zod";
import type { CaptureGuestResponse, WifiPasswordResponse, captureGuestRequest, recordVisitRequest, wifiPasswordRequest } from "@/lib/api/contracts";
import { wifiGateActive } from "@/lib/venue/features";
import { getDb, transaction, type Db } from "../db";
import { ServiceError } from "../http";
import { findCustomerById, recordVisit, upsertCustomer, type CustomerRow } from "../repositories/customers";
import { findCardHolder } from "../repositories/loyalty-cards";
import { findVenue } from "../repositories/venues";

/** The Wi-Fi email gate: a guest record for the owner's list (no card, no stamp). */
export async function captureGuest(input: z.output<typeof captureGuestRequest>): Promise<CaptureGuestResponse> {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  if (!wifiGateActive(venue)) throw new ServiceError(403, "This venue doesn't ask for an email for its Wi-Fi");

  const customer = await transaction(async (db) => {
    const { customer } = await upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: "wifi",
    });
    await recordVisit(db, venue.id, customer.id, "wifi_tap");
    return customer;
  });
  return { customerId: customer.id };
}

/** The guest a phone names: by the id it got at the Wi-Fi gate, or by the card it holds. */
async function findKnownGuest(db: Db, venueId: string, guest: { customerId?: string; card?: { cardId: string; token: string } }): Promise<CustomerRow | null> {
  if (guest.customerId) return await findCustomerById(db, venueId, guest.customerId);
  const holder = guest.card ? await findCardHolder(db, venueId, guest.card.cardId, guest.card.token) : null;
  return holder ? await findCustomerById(db, venueId, holder) : null;
}

/** The gated Wi-Fi password, for a guest this venue has an email for (a card member counts). */
export async function wifiPassword(input: z.output<typeof wifiPasswordRequest>): Promise<WifiPasswordResponse> {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  if (!await findKnownGuest(await getDb(), venue.id, input)) throw new ServiceError(404, "Unknown guest");
  return { password: venue.wifi?.password?.trim() || null };
}

export async function recordGuestVisit(input: z.output<typeof recordVisitRequest>) {
  const db = await getDb();
  const guest = await findKnownGuest(db, input.venueId, input);
  if (!guest) throw new ServiceError(404, "Unknown guest");
  await recordVisit(db, input.venueId, guest.id, input.type);
}
