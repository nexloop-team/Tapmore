"use client";

import { useSyncExternalStore } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { StaffCardView } from "@/lib/api/staff-contracts";

/**
 * Till actions made while the connection is down: kept on this device and
 * sent, in order, when it comes back. Each carries its own request id, so
 * the server applies it once however often it arrives (see stampCard). Only
 * for two minutes: after that the guest has likely left the counter, so the
 * action is dropped and staff are told to scan the card again, rather than
 * a stamp turning up out of nowhere later.
 */

export const QUEUE_LIMIT_MS = 2 * 60_000;
const KEY = "tt.till.queue";
/** Kept until dismissed, so a reload of the till doesn't hide what wasn't sent. */
const PROBLEMS_KEY = "tt.till.problems";

export type TillAction = { id: string; cardId: string; guest: string; at: number } & (
  | { kind: "stamp"; count: number; force: boolean }
  | { kind: "redeem"; tierIndex: number; reward: string }
  | { kind: "undo" }
);

interface QueueState {
  waiting: TillAction[];
  /** What couldn't be sent, for staff to put right (newest last). */
  problems: { id: string; text: string }[];
}

let state: QueueState = { waiting: read(KEY), problems: read(PROBLEMS_KEY) };
const listeners = new Set<() => void>();
const sentListeners = new Set<(cardId: string, view: StaffCardView) => void>();

function read<T>(key: string): T[] {
  try {
    return typeof localStorage === "undefined" ? [] : ((JSON.parse(localStorage.getItem(key) ?? "[]") as T[]) ?? []);
  } catch {
    return [];
  }
}

function set(next: QueueState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.waiting));
    localStorage.setItem(PROBLEMS_KEY, JSON.stringify(next.problems));
  } catch {
    /* private mode: the queue lives as long as the page */
  }
  for (const listener of listeners) listener();
}

const EMPTY: QueueState = { waiting: [], problems: [] };
export function useTillQueue(): QueueState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => EMPTY,
  );
}

/** Tells an open card panel when one of its queued actions reached the server. */
export function onQueuedSent(listener: (cardId: string, view: StaffCardView) => void) {
  sentListeners.add(listener);
  return () => {
    sentListeners.delete(listener);
  };
}

export function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function enqueue(action: TillAction) {
  set({ ...state, waiting: [...state.waiting, action] });
}

export function dismissProblem(id: string) {
  set({ ...state, problems: state.problems.filter((problem) => problem.id !== id) });
}

function describe(action: TillAction): string {
  if (action.kind === "stamp") return action.count === 1 ? "stamp" : `${action.count} stamps`;
  if (action.kind === "redeem") return action.reward;
  return "undo";
}

function send(action: TillAction): Promise<StaffCardView> {
  if (action.kind === "stamp") return dashboardApi.staffStamp({ cardId: action.cardId, count: action.count, force: action.force, requestId: action.id });
  if (action.kind === "redeem") return dashboardApi.staffRedeem({ cardId: action.cardId, tierIndex: action.tierIndex, requestId: action.id });
  return dashboardApi.staffUndo({ cardId: action.cardId, requestId: action.id });
}

/** Drops what's too old to send, telling staff. */
export function expireQueue(now = Date.now()) {
  const old = state.waiting.filter((action) => now - action.at > QUEUE_LIMIT_MS);
  if (old.length === 0) return;
  set({
    waiting: state.waiting.filter((action) => !old.includes(action)),
    problems: [...state.problems, ...old.map((action) => ({ id: action.id, text: `Not sent: ${action.guest}'s ${describe(action)} (no connection for 2 minutes). Scan their card again.` }))],
  });
}

let flushing = false;

/** Sends what's waiting, oldest first; stops at the first sign the connection is still down. */
export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    expireQueue();
    while (state.waiting.length > 0) {
      const action = state.waiting[0];
      try {
        const view = await send(action);
        set({ ...state, waiting: state.waiting.slice(1) });
        for (const listener of sentListeners) listener(action.cardId, view);
      } catch (error) {
        // Still no connection: keep it for the next try.
        if (error instanceof ApiRequestError && error.status === 0) return;
        set({
          waiting: state.waiting.slice(1),
          problems: [...state.problems, { id: action.id, text: `Not sent: ${action.guest}'s ${describe(action)}. ${errorMessage(error)}` }],
        });
      }
    }
  } finally {
    flushing = false;
  }
}
