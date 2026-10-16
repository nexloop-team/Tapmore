import { z } from "zod";
import { shortCodeSchema, venueConfigPatch } from "../venue/schema";

/** Request contracts for merchant accounts and the dashboard API. */

const email = z.string().trim().toLowerCase().min(3).max(254).email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters").max(200, "That password is too long");
const name = z.string().trim().min(1, "Tell us your name").max(80);

/** Cloudflare Turnstile token; only required when the server has a captcha secret. */
const captchaToken = z.string().max(4096).optional();

export const signupRequest = z.object({ name, email, password, captchaToken });
export type SignupRequest = z.input<typeof signupRequest>;

export const loginRequest = z.object({ email, password: z.string().min(1, "Enter your password").max(200) });
export type LoginRequest = z.input<typeof loginRequest>;

export const forgotPasswordRequest = z.object({ email, captchaToken });
export type ForgotPasswordRequest = z.input<typeof forgotPasswordRequest>;

export const resetPasswordRequest = z.object({ token: z.string().min(10).max(200), password });
export type ResetPasswordRequest = z.input<typeof resetPasswordRequest>;

export const updateAccountRequest = z.object({ name });
export type UpdateAccountRequest = z.input<typeof updateAccountRequest>;

export const changePasswordRequest = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
export type ChangePasswordRequest = z.input<typeof changePasswordRequest>;


export const deleteAccountRequest = z.object({ password: z.string().min(1, "Enter your password").max(200) });
export type DeleteAccountRequest = z.input<typeof deleteAccountRequest>;

export const updateVenueRequest = z.object({ config: venueConfigPatch.optional(), shortCode: shortCodeSchema.optional() });
export type UpdateVenueRequest = z.input<typeof updateVenueRequest>;

export const deleteVenueRequest = z.object({ confirmName: z.string().max(200) });

export const explainDishesRequest = z.object({
  items: z
    .array(z.object({ id: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).nullish() }))
    .min(1)
    .max(150),
  /** true: only dishes most guests wouldn't recognise get a note. */
  onlyUnfamiliar: z.boolean(),
});
export type ExplainDishesRequest = z.input<typeof explainDishesRequest>;

/** Razorpay Checkout's signed success response. */
export const confirmPaymentRequest = z.object({
  paymentId: z.string().min(1).max(100),
  subscriptionId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});
export type ConfirmPaymentRequest = z.input<typeof confirmPaymentRequest>;

/** What the billing page needs to open Razorpay Checkout, or (dev mode) where to go next. */
export type CheckoutStart =
  | { kind: "redirect"; url: string }
  | { kind: "razorpay"; keyId: string; subscriptionId: string; name: string; description: string; prefill: { name: string; email: string }; fallbackUrl: string | null };

export const adminVenueRequest = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  /** Give or take away free access (no charge); never touches a Razorpay subscription. */
  freeAccess: z.boolean().optional(),
  /** Push the trial end out by this many days (from today if it already ended). */
  extendTrialDays: z.number().int().min(1).max(90).optional(),
  /** Stop the paid subscription renewing; the venue stays live until the paid year ends. */
  cancelRenewal: z.literal(true).optional(),
});
export type AdminVenueRequest = z.input<typeof adminVenueRequest>;

/** Deleting a venue from the admin console: its name, typed to confirm. */
export const adminDeleteVenueRequest = z.object({ confirmName: z.string().max(200) });
export type AdminDeleteVenueRequest = z.input<typeof adminDeleteVenueRequest>;

export const adminEditModeRequest = z.object({ on: z.boolean() });
export type AdminEditModeRequest = z.input<typeof adminEditModeRequest>;

export const adminUserRequest = z.object({
  action: z.enum(["resend_verification", "send_reset", "block", "unblock", "make_admin", "remove_admin"]),
});
export type AdminUserRequest = z.input<typeof adminUserRequest>;

export const adminDeleteUserRequest = z.object({ confirmEmail: z.string().max(254) });
export type AdminDeleteUserRequest = z.input<typeof adminDeleteUserRequest>;
