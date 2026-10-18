import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "../db";
import { ServiceError } from "../http";
import { newToken } from "../ids";
import { findSessionUser, type User } from "../repositories/users";

/**
 * Database sessions: the cookie holds a random token, the table holds only
 * its SHA-256, so a leaked database can't be replayed as cookies and a
 * session can be revoked by deleting its row.
 */
const SESSION_COOKIE = "tt_session";
/**
 * A hint, readable by scripts, that this browser is signed in: the static
 * home page shows "Dashboard" instead of "Sign in" from it. It proves
 * nothing; the session cookie (HttpOnly) is what signs anyone in.
 */
const SIGNED_IN_HINT = "tt_signed_in";
/** A session ends after this many days without a visit; every visit pushes the end back. */
const SESSION_DAYS = 90;
/** The cookie outlives the session so coming back extends it (browsers cap cookies at 400 days). */
const COOKIE_DAYS = 400;
const DAY_MS = 86_400_000;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createSession(userId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  (await (await getDb()).run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", digest(token), userId, expires.toISOString()));
  const jar = await cookies();
  const options = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: new Date(Date.now() + COOKIE_DAYS * DAY_MS) };
  jar.set(SESSION_COOKIE, token, { ...options, httpOnly: true });
  jar.set(SIGNED_IN_HINT, "1", options);
}

async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in merchant, looked up once per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const found = await findSessionUser(digest(token));
  if (!found || Date.parse(found.expiresAt) <= Date.now()) return null;
  // Coming back keeps you signed in: slide the end forward, at most one write a day.
  if (Date.parse(found.expiresAt) < Date.now() + (SESSION_DAYS - 1) * DAY_MS) {
    (await (await getDb()).run("UPDATE sessions SET expires_at = ? WHERE id = ?", new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString(), digest(token)));
  }
  return found.user.blocked ? null : found.user;
});

export async function destroySession() {
  const token = await sessionToken();
  if (token) (await (await getDb()).run("DELETE FROM sessions WHERE id = ?", digest(token)));
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
}

/** After a password change or reset: every other device has to sign in again. */
export async function destroyOtherSessions(userId: string) {
  const token = await sessionToken();
  (await (await getDb()).run("DELETE FROM sessions WHERE user_id = ? AND id != ?", userId, token ? digest(token) : ""));
}

export async function destroyAllSessions(userId: string) {
  (await (await getDb()).run("DELETE FROM sessions WHERE user_id = ?", userId));
}

/** Server components: send anonymous visitors to the login page, then back to where they were. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname");
    redirect(path && path.startsWith("/") && !path.startsWith("//") ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }
  return user;
}

/** Route handlers: a JSON 401 instead of a redirect. */
export async function requireApiUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new ServiceError(401, "Please sign in again");
  return user;
}

/** This account's email is in ADMIN_EMAILS, confirmed or not (to tell an unconfirmed admin what's missing). */
export function isListedSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email);
}

/** Super admins are named by email in ADMIN_EMAILS, so nobody inside the app can grant or take it away. */
export function isSuperAdmin(user: User | null): boolean {
  return !!user && user.emailVerified && isListedSuperAdmin(user);
}

/** May use the operator console: a super admin, or someone a super admin made an admin. */
export function isAdmin(user: User | null): boolean {
  return !!user && user.emailVerified && (user.adminRole || isSuperAdmin(user));
}

type AuthTokenPurpose = "verify_email" | "reset_password";

/** One-time link tokens (email verification, password reset); stored hashed like sessions. */
export async function createAuthToken(userId: string, purpose: AuthTokenPurpose, ttlMinutes: number): Promise<string> {
  const token = newToken();
  const db = await getDb();
  // A new link supersedes any earlier one for the same purpose.
  (await db.run("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?", userId, purpose));
  (await db.run("INSERT INTO auth_tokens (id, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)", digest(token),
    userId,
    purpose,
    new Date(Date.now() + ttlMinutes * 60_000).toISOString(),));
  return token;
}

/** Returns the user id once; a second use, an expired or a wrong-purpose token gives null. */
export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose): Promise<string | null> {
  const db = await getDb();
  const row = (await db.get("SELECT user_id, expires_at, used_at FROM auth_tokens WHERE id = ? AND purpose = ?", digest(token), purpose)) as
    | { user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) return null;
  const result = (await db.run("UPDATE auth_tokens SET used_at = now() WHERE id = ? AND used_at IS NULL", digest(token)));
  return result.changes === 1 ? row.user_id : null;
}
