import "server-only";
import type { Db } from "../db";
import type { z } from "zod";
import type { EnrollResponse, StampResponse, enrollRequest, stampRequest } from "@/lib/api/contracts";
import { isValidBirthday } from "@/lib/validation";
import { birthdayAskOn, hasLoyaltyProgram, isRewardsOnly } from "@/lib/venue/features";
import { programTiers, stampGoal } from "@/lib/venue/loyalty";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb, transaction } from "../db";
import { ServiceError, underLimit } from "../http";
import { findCustomerByEmail, recordMembershipAgreement, setBirthday, upsertCustomer } from "../repositories/customers";
import { claimFeedbackStamp } from "../repositories/feedback";
import { addFeedbackStamp, createCard, findCardByCustomer, findCardHolder, lockCard, markPassEmailed, setCardStamps, type LoyaltyCardRow } from "../repositories/loyalty-cards";
import { attachReferral, findReferrerCard } from "../repositories/retention";
import { recordStampEvent } from "../repositories/stamps";
import { friendJoinBonus } from "./retention";
import { findVenue, getVenueSettings } from "../repositories/venues";
import { sendMail } from "./mailer";

/**
 * A returning member (a new phone, a lost card) is emailed their card link
 * again straight away, never shown it on the page, since anyone can type an
 * email. Capped per card, so typing someone's address can't flood their inbox.
 */
const PASS_RESENDS_PER_HOUR = 3;
const PASS_RESENDS_PER_DAY = 6;
const HOUR_MS = 60 * 60_000;

async function passResendAllowed(cardId: string): Promise<boolean> {
  return (await underLimit(`pass-resend-hour:${cardId}`, PASS_RESENDS_PER_HOUR, HOUR_MS))
    && (await underLimit(`pass-resend-day:${cardId}`, PASS_RESENDS_PER_DAY, 24 * HOUR_MS));
}

async function requireVenue(venueId: string): Promise<PublicVenue> {
  const venue = await findVenue(venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  return venue;
}

function cardUrl(origin: string, card: LoyaltyCardRow) {
  return `${origin}/card/${card.id}?t=${card.access_token}`;
}

async function sendCardEmail(venue: PublicVenue, email: string, card: LoyaltyCardRow, origin: string): Promise<boolean> {
  return await sendMail({
    to: email,
    subject: `Your ${venue.name} rewards card`,
    // Also the notice for guests signed up at the till, who never saw the join form.
    text: [
      `Here's your ${venue.name} card. Keep this link handy and show it when you visit:`,
      cardUrl(origin, card),
      "",
      `You joined ${venue.name}'s membership, so your card, rewards and a birthday wish come by email. You can delete your card and details any time from the bottom of your card.`,
      `Privacy notice: ${origin}/privacy`,
    ].join("\n"),
  });
}

/** A join from the guest page, or from the till ("till": staff signed the guest up at the counter). */
type EnrollInput = Omit<z.output<typeof enrollRequest>, "captureSource"> & { captureSource?: z.output<typeof enrollRequest>["captureSource"] | "till" };

export async function enroll(input: EnrollInput, origin: string): Promise<EnrollResponse> {
  const venue = await requireVenue(input.venueId);
  const rewardsOnly = isRewardsOnly(venue);
  if (!hasLoyaltyProgram(venue) && !rewardsOnly) throw new ServiceError(400, "This venue does not have a loyalty program");

  // The CRM doors each have their own switch; the home card is always open.
  if (input.door === "feedback" && !venue.crm.feedbackCapture) throw new ServiceError(403, "Joining is not available here");

  const isRewardsJoin = input.captureSource === "rewards";

  const feedbackStampOn = (await getVenueSettings(venue.id)).stampPolicy.feedbackStamp;

  const result = await transaction(async (db) => {
    const { customer } = await upsertCustomer(db, {
      venueId: venue.id,
      email: input.email,
      firstName: input.firstName ?? null,
      name: input.name ?? input.firstName ?? null,
      locale: input.locale ?? null,
      captureSource: input.captureSource ?? "landing",
    });
    let card = await findCardByCustomer(db, customer.id);
    const wasExisting = !!card;
    if (!card) {
      // The join stamp is the server's call: only a receipt for feedback just
      // posted earns it. Never on rewards-only.
      let stamps = 0;
      if (!rewardsOnly && !isRewardsJoin && input.initialStamps === 1 && input.captureSource === "feedback" && feedbackStampOn && input.feedbackReceipt) {
        stamps = (await claimFeedbackStamp(db, venue.id, input.feedbackReceipt.feedbackId, input.feedbackReceipt.token)) ? 1 : 0;
      }
      card = await createCard(db, venue.id, customer.id, stamps);
      if (input.captureSource === "feedback" && stamps > 0) await addFeedbackStampCooldownOnly(db, card.id);
      // Joined through a member's invite: link the cards (the inviter is
      // rewarded at the friend's first staff stamp) and add welcome stamps.
      const referrer = input.ref && !rewardsOnly && !isRewardsJoin ? await findReferrerCard(db, venue.id, input.ref) : null;
      if (referrer && referrer.customer_id !== customer.id && venue.loyaltyProgram?.referral?.enabled) {
        await attachReferral(db, card.id, referrer.id);
        const bonus = friendJoinBonus(venue, card.stamps);
        if (bonus > 0) {
          await setCardStamps(db, card.id, card.stamps + bonus);
          await recordStampEvent(db, { venueId: venue.id, cardId: card.id, kind: "bonus", delta: bonus });
        }
        card = (await findCardByCustomer(db, customer.id))!;
      }
    }
    if (input.agreed) await recordMembershipAgreement(db, customer.id);
    // The birthday is for the treat at the counter (and by email only with consent).
    // Only on a new card: re-joining with someone else's email mustn't set their birthday.
    if (!wasExisting && input.birthday && birthdayAskOn(venue) && isValidBirthday(input.birthday.month, input.birthday.day)) {
      await setBirthday(db, customer.id, input.birthday.month, input.birthday.day);
    }
    return { customer, card, wasExisting };
  });

  const { customer, card, wasExisting } = result;
  const shouldEmail = !wasExisting || await passResendAllowed(card.id);
  const passEmailed = shouldEmail && await sendCardEmail(venue, customer.email, card, origin);
  if (passEmailed) await markPassEmailed(await getDb(), card.id);

  // A returning member is sent their card again by email rather than shown
  // it here: an email address is no proof of who's typing it, and the card's
  // QR code is what staff scan to hand out a reward. The till can still find
  // them by name or email.

  return {
    customerId: wasExisting ? null : customer.id,
    cardId: card.id,
    wasExisting,
    passEmailed,
    cardUrl: wasExisting ? null : cardUrl(origin, card),
  };
}

/** The join already granted the feedback stamp; start the cooldown without adding another. */
async function addFeedbackStampCooldownOnly(db: Db, cardId: string) {
  (await db.run("UPDATE loyalty_cards SET last_feedback_stamp_at = now() WHERE id = ?", cardId));
}

/**
 * Stamps an existing member for the feedback they just posted: it needs that
 * feedback's one-time receipt, and gives at most one stamp a day. Every
 * refusal (not a member, cooldown, used receipt) answers the same
 * `stamped: false` without the balance, so the endpoint cannot be used to
 * test whether an address is a member.
 */
export async function stampForFeedback(input: z.output<typeof stampRequest>): Promise<StampResponse> {
  const venue = await requireVenue(input.venueId);
  if (!hasLoyaltyProgram(venue)) throw new ServiceError(400, "This venue does not have a stamp card");
  const refused = { stamped: false, currentStamps: 0 };
  if (!(await getVenueSettings(venue.id)).stampPolicy.feedbackStamp) return refused;
  const goal = stampGoal(programTiers(venue.loyaltyProgram));
  return await transaction(async (db) => {
    const holder = input.card ? await findCardHolder(db, venue.id, input.card.cardId, input.card.token) : null;
    const customer = holder ? { id: holder } : input.email ? await findCustomerByEmail(db, venue.id, input.email) : null;
    const found = customer ? await findCardByCustomer(db, customer.id) : null;
    const card = found ? await lockCard(db, found.id) : null;
    // Once per member, ever: feedback can be sent from anywhere, so it can't keep earning stamps.
    // Joining after feedback with its free stamp counts as that once.
    if (!card || card.last_feedback_stamp_at) return refused;
    if (!(await claimFeedbackStamp(db, venue.id, input.feedbackReceipt.feedbackId, input.feedbackReceipt.token))) return refused;
    return { stamped: true, currentStamps: await addFeedbackStamp(db, card.id, goal) };
  });
}
