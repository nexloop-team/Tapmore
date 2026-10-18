import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** Blocked by an operator: can't sign in, and existing sessions stop working. */
  blocked: boolean;
  /** Made an admin from the console (super admins come from ADMIN_EMAILS instead). */
  adminRole: boolean;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  blocked_at: string | null;
  is_admin: number;
  created_at: string;
}

function toUser(row: Omit<UserRow, "password_hash">): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: !!row.email_verified_at,
    blocked: !!row.blocked_at,
    adminRole: !!row.is_admin,
    createdAt: row.created_at,
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const row = (await (await getDb()).get("SELECT * FROM users WHERE id = ?", id)) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** A session's user and when the session ends, in one round trip (never the password hash). */
export async function findSessionUser(sessionId: string): Promise<{ user: User; expiresAt: string } | null> {
  const row = (await (await getDb()).get(
    `SELECT s.expires_at AS session_expires_at, u.id, u.email, u.name, u.email_verified_at, u.blocked_at, u.is_admin, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    sessionId,
  )) as (Omit<UserRow, "password_hash"> & { session_expires_at: string }) | undefined;
  return row ? { user: toUser(row), expiresAt: row.session_expires_at } : null;
}

/** Includes the hash: only the login and password-change paths need it. */
export async function findUserCredentials(email: string): Promise<{ user: User; passwordHash: string } | null> {
  const row = (await (await getDb()).get("SELECT * FROM users WHERE email = ?", email)) as UserRow | undefined;
  return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
}

export async function findPasswordHash(userId: string): Promise<string | null> {
  const row = (await (await getDb()).get("SELECT password_hash FROM users WHERE id = ?", userId)) as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

export async function emailTaken(email: string): Promise<boolean> {
  return !!(await (await getDb()).get("SELECT 1 FROM users WHERE email = ?", email));
}

export async function insertUser(input: { email: string; name: string; passwordHash: string }): Promise<User> {
  const id = newId("usr");
  (await (await getDb()).run("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)", id, input.email, input.name, input.passwordHash));
  return (await findUserById(id))!;
}

export async function updateUserName(userId: string, name: string) {
  (await (await getDb()).run("UPDATE users SET name = ? WHERE id = ?", name, userId));
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  (await (await getDb()).run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, userId));
}

export async function markEmailVerified(userId: string) {
  (await (await getDb()).run("UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ?", userId));
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  (await (await getDb()).run("UPDATE users SET blocked_at = CASE WHEN ? = 1 THEN COALESCE(blocked_at, now()) ELSE NULL END WHERE id = ?", blocked ? 1 : 0, userId));
}

export async function setAdminRole(userId: string, admin: boolean) {
  (await (await getDb()).run("UPDATE users SET is_admin = ? WHERE id = ?", admin ? 1 : 0, userId));
}

export interface AdminUserRow extends User {
  venueCount: number;
}

export async function listUsersForAdmin(limit = 200): Promise<AdminUserRow[]> {
  const rows = (await (await getDb()).all(
      `SELECT u.id, u.email, u.name, u.email_verified_at, u.blocked_at, u.is_admin, u.created_at, COUNT(m.venue_id) AS venue_count
       FROM users u LEFT JOIN venue_members m ON m.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ?`, limit)) as unknown as (UserRow & { venue_count: number })[];
  return rows.map((row) => ({ ...toUser(row), venueCount: row.venue_count }));
}
