import "server-only";
import type { Db } from "../db";
import { accessState, parseDbDate, type AccessState, type SubscriptionState, type SubscriptionStatus } from "@/lib/plans";
import { getDb } from "../db";
import { forgetVenue } from "../venue-cache";

export interface Subscription extends SubscriptionState {
  venueId: string;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  /** Cancelled by the owner: stays paid until `currentPeriodEnd`, then lapses. */
  cancelAtPeriodEnd: boolean;
  /** Last change, e.g. when a payment failed or the subscription ended. */
  updatedAt: string | null;
}

interface SubscriptionRow {
  venue_id: string;
  /** 'pro' marks a paid subscription; the column predates the single plan. */
  plan: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  cancel_at_period_end: number;
  updated_at: string | null;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    venueId: row.venue_id,
    paid: row.plan === "pro",
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    updatedAt: row.updated_at,
  };
}

export async function getSubscription(venueId: string): Promise<Subscription | null> {
  const row = (await (await getDb()).get("SELECT * FROM subscriptions WHERE venue_id = ?", venueId)) as SubscriptionRow | undefined;
  return row ? toSubscription(row) : null;
}

export async function findSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
  const row = (await (await getDb()).get("SELECT * FROM subscriptions WHERE provider_subscription_id = ?", providerSubscriptionId)) as SubscriptionRow | undefined;
  return row ? toSubscription(row) : null;
}

export async function venueAccess(venueId: string): Promise<AccessState> {
  return accessState(await getSubscription(venueId));
}

/** Paid or on the trial: the guest page is live and every feature works. */
export async function venueHasAccess(venueId: string): Promise<boolean> {
  return await venueAccess(venueId) !== "unpaid";
}

/** New venues start with the free trial running; no card needed. */
export async function startTrial(db: Db, venueId: string, trialDays: number) {
  (await db.run("INSERT INTO subscriptions (venue_id, plan, status, trial_ends_at) VALUES (?, 'free', 'active', ?)", venueId,
    new Date(Date.now() + trialDays * 86_400_000).toISOString(),));
}

/** Push the trial end out by `days`, counting from today if it already ended. */
export async function extendTrial(venueId: string, days: number) {
  const db = await getDb();
  (await db.run("INSERT INTO subscriptions (venue_id) VALUES (?) ON CONFLICT DO NOTHING", venueId));
  const current = parseDbDate((await getSubscription(venueId))?.trialEndsAt) ?? 0;
  const ends = new Date(Math.max(current, Date.now()) + days * 86_400_000).toISOString();
  (await db.run("UPDATE subscriptions SET trial_ends_at = ?, updated_at = now() WHERE venue_id = ?", ends, venueId));
  forgetVenue(venueId);
}

export interface SubscriptionUpdate {
  paid?: boolean;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
}

const COLUMNS: Record<keyof SubscriptionUpdate, string> = {
  paid: "plan",
  status: "status",
  currentPeriodEnd: "current_period_end",
  provider: "provider",
  providerCustomerId: "provider_customer_id",
  providerSubscriptionId: "provider_subscription_id",
  cancelAtPeriodEnd: "cancel_at_period_end",
};

export async function updateSubscription(venueId: string, update: SubscriptionUpdate) {
  const db = await getDb();
  (await db.run("INSERT INTO subscriptions (venue_id) VALUES (?) ON CONFLICT DO NOTHING", venueId));
  const keys = (Object.keys(update) as (keyof SubscriptionUpdate)[]).filter((key) => update[key] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((key) => `${COLUMNS[key]} = ?`).join(", ");
  (await db.run(`UPDATE subscriptions SET ${sets}, updated_at = now() WHERE venue_id = ?`, ...keys.map((key) => (key === "paid" ? (update.paid ? "pro" : "free") : key === "cancelAtPeriodEnd" ? (update.cancelAtPeriodEnd ? 1 : 0) : (update[key] ?? null))),
    venueId,));
  forgetVenue(venueId);
}
