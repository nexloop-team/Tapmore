import "server-only";
import { BRAND } from "@/config/brand";
import { birthdayAskOn } from "@/lib/venue/features";
import { venueTimeZone } from "@/lib/venue/region";
import type { PublicVenue } from "@/lib/venue/types";
import { getDb } from "../db";
import { appOrigin } from "../origin";
import { birthdayGuests, claimGuestEmail, ensureUnsubscribeToken, releaseGuestEmail, type EmailableGuest } from "../repositories/retention";
import { venueHasAccess } from "../repositories/subscriptions";
import { getVenueSettings } from "../repositories/venues";
import { renderEmail, type EmailContent } from "../services/email-template";
import { sendMail } from "../services/mailer";
import { localParts } from "./time";

/**
 * The birthday wish: on a card member's birthday (the venue's date), a short
 * "Happy birthday" inviting them in for the venue's birthday reward, without
 * naming it. It's part of the membership, so every card member who gave a
 * birthday gets it unless they unsubscribed. Only in daytime, once a year,
 * and always with a one-click unsubscribe.
 */

const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 20;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

type MemberEmail = Omit<EmailContent, "brand" | "footer" | "footerLinks">;

/** Sent once per key, from "{venue} via Tapmore", with the member footer and one-click unsubscribe. */
async function send(guest: EmailableGuest, kind: string, key: string, subject: string, content: MemberEmail, venueName: string): Promise<boolean> {
  if (!await claimGuestEmail(guest.id, kind, key)) return false;
  const token = await ensureUnsubscribeToken(guest.id);
  const ok = await sendMail({
    to: guest.email,
    subject,
    fromName: `${venueName} via ${BRAND.name}`,
    ...renderEmail({
      ...content,
      brand: venueName,
      footer: [`You're getting this as a member of ${venueName}'s card.`, `${venueName} · via ${BRAND.name}`],
      footerLinks: [{ label: "Unsubscribe", url: `${appOrigin()}/unsubscribe?token=${token}` }],
    }),
    headers: {
      "List-Unsubscribe": `<${appOrigin()}/api/unsubscribe?token=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (!ok) await releaseGuestEmail(guest.id, kind, key);
  return ok;
}

export async function runGuestAutomations(now: Date): Promise<number> {
  const venues = (await (await getDb()).all(
    "SELECT id, (config::jsonb->>'name') AS name, (config::jsonb->>'currencyCode') AS currency, (config::jsonb->'crm') AS crm FROM venues WHERE status = 'active'",
  )) as {
    id: string;
    name: string;
    currency: string | null;
    crm: PublicVenue["crm"] | null;
  }[];
  let sent = 0;
  for (const venue of venues) {
    // Daytime where the venue is, never the middle of its guests' night.
    const local = localParts(now, venueTimeZone(venue.currency));
    if (local.hour < SEND_FROM_HOUR || local.hour >= SEND_UNTIL_HOUR) continue;
    // Only while the venue has a birthday reward to come in for, and asks for birthdays.
    if (!venue.crm || !birthdayAskOn({ crm: venue.crm })) continue;
    const { birthday } = (await getVenueSettings(venue.id)).automations;
    if (!birthday.enabled || !birthday.offer.trim()) continue;
    if (!await venueHasAccess(venue.id)) continue;

    // 29 February birthdays are celebrated on 1 March in other years.
    const leapDayGuests = local.month === 3 && local.day === 1 && !isLeapYear(local.year) ? await birthdayGuests(venue.id, 2, [29]) : [];
    const guests = [...(await birthdayGuests(venue.id, local.month, [local.day])), ...leapDayGuests];
    for (const guest of guests) {
      const ok = await send(
        guest,
        "birthday",
        String(local.year),
        `Happy birthday from ${venue.name}!`,
        {
          preheader: "A birthday reward is waiting for you today.",
          greeting: `Hi ${guest.firstName || "there"},`,
          heading: "Happy birthday! 🎂",
          paragraphs: [
            `Happy birthday from everyone at ${venue.name}! We hope you have a lovely day.`,
            `Come in to ${venue.name} today for your birthday reward. Just show your card at the counter.`,
            "See you soon!",
          ],
        },
        venue.name,
      );
      if (ok) sent += 1;
    }
  }
  return sent;
}
