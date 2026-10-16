import { z } from "zod";

/** Requests from a paired staff device, and the owner's device management. */

const cardId = z.string().trim().regex(/^crd_[A-Za-z0-9]{1,40}$/, "Invalid card");

export const staffStampRequest = z.object({
  cardId,
  count: z.number().int().min(1).max(5).default(1),
  /** Staff confirmed "add another" inside the cooldown. */
  force: z.boolean().optional(),
});
export type StaffStampRequest = z.input<typeof staffStampRequest>;

export const staffRedeemRequest = z.object({ cardId, tierIndex: z.number().int().min(0).max(10) });
export type StaffRedeemRequest = z.input<typeof staffRedeemRequest>;

export const staffUndoRequest = z.object({ cardId });
export type StaffUndoRequest = z.input<typeof staffUndoRequest>;

export const staffBirthdayRequest = z.object({ cardId });
export type StaffBirthdayRequest = z.input<typeof staffBirthdayRequest>;

/** Staff sign a guest up at the counter. */
export const staffEnrollRequest = z.object({
  name: z.string().trim().min(1, "Enter the guest's name").max(120),
  email: z.string().trim().toLowerCase().min(3).max(254),
  birthday: z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }).optional(),
  /** Staff asked, and the guest agreed to join. */
  agreed: z.literal(true, { error: "Ask the guest if they agree to join first" }),
});
export type StaffEnrollRequest = z.input<typeof staffEnrollRequest>;
export interface StaffEnrollResponse {
  cardId: string;
  /** The email already had a card here: the till opens that one. */
  wasExisting: boolean;
}

/** Staff add or correct the guest's birthday, with the guest at the counter. */
export const staffBirthdayDateRequest = z.object({ cardId, month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) });
export type StaffBirthdayDateRequest = z.input<typeof staffBirthdayDateRequest>;

/** What the till screen shows for one card. */
export interface StaffCardView {
  cardId: string;
  venueName: string;
  guestName: string | null;
  /** Masked, enough to confirm it's the right person. */
  guestEmail: string;
  stamps: number;
  goal: number;
  tiers: { index: number; rewardName: string; stampsRequired: number; unlocked: boolean }[];
  /** The last stamp or redemption, if it can still be undone. */
  undoable: { kind: string; delta: number; rewardName: string | null } | null;
  /** When the card was made (ISO), for "Member since May". */
  memberSince: string;
  /** Visits with a stamp, for "23 visits". */
  visits: number;
  /** Minutes since the last stamp, while still inside the venue's cooldown; null otherwise. */
  stampedMinutesAgo: number | null;
  /** The owner's birthday reward on the guest's birthday, and whether staff already gave it; null otherwise. */
  birthday: { reward: string; given: boolean } | null;
  /** The guest's birthday on file; null if they haven't given one. */
  birthdayDate: { month: number; day: number } | null;
  /** The venue asks for birthdays, so staff may add or correct one. */
  asksBirthday: boolean;
}

export const inviteStaffRequest = z.object({ email: z.string().trim().min(1, "Enter the staff member's email address").max(200) });

export const addStaffDeviceRequest = z.object({ label: z.string().trim().min(1, "Name the device, e.g. “Front till”").max(40) });
export type AddStaffDeviceRequest = z.input<typeof addStaffDeviceRequest>;
