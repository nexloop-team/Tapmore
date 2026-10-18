import type {
  AdminDeleteUserRequest,
  AdminDeleteVenueRequest,
  AdminEditModeRequest,
  AdminUserRequest,
  AdminVenueRequest,
  ChangePasswordRequest,
  CheckoutStart,
  ConfirmPaymentRequest,
  DeleteAccountRequest,
  ExplainDishesRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupRequest,
  UpdateAccountRequest,
  UpdateVenueRequest,
} from "./account-contracts";
import { shrinkPhotoForUpload } from "../browser";
import { ApiRequestError } from "./client";
import type {
  AddStaffDeviceRequest,
  StaffBirthdayDateRequest,
  StaffBirthdayRequest,
  StaffCardView,
  StaffEnrollRequest,
  StaffEnrollResponse,
  StaffRedeemRequest,
  StaffStampRequest,
  StaffUndoRequest,
} from "./staff-contracts";
import type { CreateVenueRequest, VenueConfig } from "../venue/schema";

type MenuSectionDraft = VenueConfig["menus"][number]["sections"][number];
import type { VenueSettings, VenueSettingsPatch } from "../venue/settings";

/** Browser client for the merchant side: auth, account, dashboard and admin APIs. */

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new ApiRequestError(0, "Couldn't reach the server. Check your connection and try again.");
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiRequestError(response.status, data?.error ?? `Request failed (${response.status})`);
  return data as T;
}

interface SavedVenue {
  id: string;
  shortCode: string;
  config: UpdateVenueRequest["config"];
}

export const dashboardApi = {
  signup: (body: SignupRequest) => send<{ ok: true }>("POST", "/api/auth/signup", body),
  /** `home`: where this user's dashboard starts (their last or only venue). */
  login: (body: LoginRequest) => send<{ ok: true; home: string }>("POST", "/api/auth/login", body),
  logout: () => send<{ ok: true }>("POST", "/api/auth/logout"),
  forgotPassword: (body: ForgotPasswordRequest) => send<{ ok: true }>("POST", "/api/auth/forgot", body),
  resetPassword: (body: ResetPasswordRequest) => send<{ ok: true }>("POST", "/api/auth/reset", body),
  resendVerification: () => send<{ ok: true }>("POST", "/api/auth/resend-verification"),

  updateAccount: (body: UpdateAccountRequest) => send<{ ok: true }>("PATCH", "/api/account", body),
  changePassword: (body: ChangePasswordRequest) => send<{ ok: true }>("POST", "/api/account/password", body),
  deleteAccount: (body: DeleteAccountRequest) => send<{ ok: true }>("DELETE", "/api/account", body),

  createVenue: (body: CreateVenueRequest) => send<{ id: string; shortCode: string }>("POST", "/api/dashboard/venues", body),
  updateVenue: (venueId: string, body: UpdateVenueRequest) => send<SavedVenue>("PATCH", `/api/dashboard/venues/${venueId}`, body),
  inviteStaff: (venueId: string, email: string) => send<{ url: string }>("POST", `/api/dashboard/venues/${venueId}/staff-members`, { email }),
  removeStaff: (venueId: string, userId: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}/staff-members/${userId}`),
  /** Back to how the page was before the last save (twice = redo). */
  restoreVenue: (venueId: string) => send<SavedVenue>("POST", `/api/dashboard/venues/${venueId}/restore`),
  deleteVenue: (venueId: string, confirmName: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}`, { confirmName }),
  checkout: (venueId: string) => send<CheckoutStart>("POST", `/api/dashboard/venues/${venueId}/billing/checkout`),
  confirmPayment: (venueId: string, body: ConfirmPaymentRequest) => send<{ ok: true }>("POST", `/api/dashboard/venues/${venueId}/billing/confirm`, body),
  cancelSubscription: (venueId: string) => send<{ ok: true }>("POST", `/api/dashboard/venues/${venueId}/billing/cancel`),

  /** `kind` sets the size the server stores it at (see services/media). */
  async uploadImage(venueId: string, file: File, kind: "logo" | "cover" | "dish"): Promise<string> {
    const form = new FormData();
    form.append("file", await shrinkPhotoForUpload(file));
    form.append("kind", kind);
    const response = await fetch(`/api/dashboard/venues/${venueId}/media`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) }).catch(() => {
      throw new ApiRequestError(0, "Upload failed. Check your connection and try again.");
    });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url) throw new ApiRequestError(response.status, data?.error ?? "Upload failed");
    return data.url;
  },

  adminUpdateVenue: (venueId: string, body: AdminVenueRequest) => send<{ ok: true }>("PATCH", `/api/admin/venues/${venueId}`, body),
  adminDeleteVenue: (venueId: string, body: AdminDeleteVenueRequest) => send<{ ok: true }>("DELETE", `/api/admin/venues/${venueId}`, body),
  adminEditMode: (venueId: string, body: AdminEditModeRequest) => send<{ ok: true }>("POST", `/api/admin/venues/${venueId}/edit-mode`, body),
  adminUpdateUser: (userId: string, body: AdminUserRequest) => send<{ ok: true }>("PATCH", `/api/admin/users/${userId}`, body),
  adminDeleteUser: (userId: string, body: AdminDeleteUserRequest) => send<{ ok: true }>("DELETE", `/api/admin/users/${userId}`, body),

  addStaffDevice: (venueId: string, body: AddStaffDeviceRequest) =>
    send<{ url: string; qrSvg: string; expiresAt: string }>("POST", `/api/dashboard/venues/${venueId}/staff-devices`, body),
  revokeStaffDevice: (venueId: string, deviceId: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}/staff-devices/${encodeURIComponent(deviceId)}`),
  explainDishes: (venueId: string, body: ExplainDishesRequest) =>
    send<{ suggestions: { itemId: string; explainer: string }[] }>("POST", `/api/dashboard/venues/${venueId}/ai/explain`, body),

  async importMenu(venueId: string, files: File[]): Promise<{ sections: MenuSectionDraft[]; flaggedItemIds: string[] }> {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    // Reading a long menu can take a minute or two.
    const response = await fetch(`/api/dashboard/venues/${venueId}/ai/menu-import`, { method: "POST", body: form, signal: AbortSignal.timeout(240_000) }).catch(() => {
      throw new ApiRequestError(0, "The import didn't finish. Check your connection and try again.");
    });
    const data = (await response.json().catch(() => null)) as { sections?: MenuSectionDraft[]; flaggedItemIds?: string[]; error?: string } | null;
    if (!response.ok || !data?.sections) throw new ApiRequestError(response.status, data?.error ?? "Import failed");
    return { sections: data.sections, flaggedItemIds: data.flaggedItemIds ?? [] };
  },

  deleteGuest: (venueId: string, customerId: string) => send<{ ok: true }>("DELETE", `/api/dashboard/venues/${venueId}/guests/${encodeURIComponent(customerId)}`),
  updateSettings: (venueId: string, body: VenueSettingsPatch) => send<VenueSettings>("PATCH", `/api/dashboard/venues/${venueId}/settings`, body),
  staffCard: (cardId: string) => send<StaffCardView>("GET", `/api/staff/card?c=${encodeURIComponent(cardId)}`),
  staffStamp: (body: StaffStampRequest) => send<StaffCardView>("POST", "/api/staff/stamp", body),
  staffRedeem: (body: StaffRedeemRequest) => send<StaffCardView>("POST", "/api/staff/redeem", body),
  staffUndo: (body: StaffUndoRequest) => send<StaffCardView>("POST", "/api/staff/undo", body),
  staffBirthday: (body: StaffBirthdayRequest) => send<StaffCardView>("POST", "/api/staff/birthday", body),
  staffBirthdayDate: (body: StaffBirthdayDateRequest) => send<StaffCardView>("POST", "/api/staff/birthday-date", body),
  staffEnroll: (body: StaffEnrollRequest) => send<StaffEnrollResponse>("POST", "/api/staff/enroll", body),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
