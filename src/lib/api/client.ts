import type {
  CaptureGuestRequest,
  CaptureGuestResponse,
  EnrollRequest,
  EnrollResponse,
  FeedbackRequest,
  FeedbackResponse,
  MemberCardView,
  RecordVisitRequest,
  StampRequest,
  StampResponse,
  WifiPasswordRequest,
  WifiPasswordResponse,
} from "./contracts";
import type { PublicVenue } from "../venue/types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Every write runs behind a disabled button, so each gets a ceiling: a hung
 * request must not leave a customer tapping a dead control at the till.
 */
async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiRequestError(response.status, body?.error ?? `Request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function post<T>(path: string, body: unknown, timeoutMs: number) {
  return request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, timeoutMs);
}

export const api = {
  getCard: (cardId: string, token: string) =>
    request<MemberCardView>(`/api/cards/${encodeURIComponent(cardId)}?t=${encodeURIComponent(token)}`, { method: "GET", cache: "no-store" }, 15_000),
  getVenue: (idOrCode: string) => request<PublicVenue>(`/api/venues/${encodeURIComponent(idOrCode)}`, { method: "GET" }, 15_000),
  enroll: (body: EnrollRequest) => post<EnrollResponse>("/api/loyalty/enroll", body, 30_000),
  stampForFeedback: (body: StampRequest) => post<StampResponse>("/api/loyalty/stamp", body, 15_000),
  submitFeedback: (body: FeedbackRequest) => post<FeedbackResponse>("/api/feedback", body, 30_000),
  captureGuest: (body: CaptureGuestRequest) => post<CaptureGuestResponse>("/api/guests/capture", body, 15_000),
  wifiPassword: (body: WifiPasswordRequest) => post<WifiPasswordResponse>("/api/guests/wifi", body, 15_000),
  recordVisit: (body: RecordVisitRequest) => post<{ ok: true }>("/api/guests/visit", body, 10_000),
};
