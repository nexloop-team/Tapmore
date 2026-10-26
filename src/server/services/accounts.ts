import "server-only";
import type { z } from "zod";
import type { changePasswordRequest, loginRequest, signupRequest } from "@/lib/api/account-contracts";
import { BRAND } from "@/config/brand";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../auth/password";
import {
  consumeAuthToken,
  createAuthToken,
  createSession,
  destroyAllSessions,
  destroyOtherSessions,
  destroySession,
} from "../auth/session";
import { getDb } from "../db";
import { ServiceError, rateLimitKey, rateLimitMany } from "../http";
import {
  emailTaken,
  findPasswordHash,
  findUserCredentials,
  insertUser,
  markEmailVerified,
  updatePasswordHash,
  type User,
} from "../repositories/users";
import { deleteVenue, membershipsOf, venuesOwnedSolelyBy } from "../repositories/venues";
import { afterResponse } from "../after";
import { stopBilling } from "./billing";
import { disconnect as disconnectGoogle } from "./reviews";
import { sendMail } from "./mailer";

export async function sendVerificationEmail(user: User, origin: string) {
  const token = await createAuthToken(user.id, "verify_email", 7 * 24 * 60);
  await sendMail({
    to: user.email,
    subject: `Confirm your email for ${BRAND.name}`,
    text: `Hi ${user.name},\n\nConfirm your email address to finish setting up your account:\n${origin}/api/auth/verify?token=${encodeURIComponent(token)}\n\nThe link works for 7 days. If you didn't sign up, ignore this email.\n\n${BRAND.name}`,
  });
}

export async function signup(input: z.output<typeof signupRequest>, origin: string): Promise<User> {
  if (await emailTaken(input.email)) throw new ServiceError(409, "An account with this email already exists. Try signing in.");
  const user = await insertUser({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) });
  await createSession(user.id);
  // The new owner goes straight on to set up their venue; the email follows.
  await afterResponse("verification email", () => sendVerificationEmail(user, origin));
  return user;
}

export async function login(input: z.output<typeof loginRequest>, ip: string): Promise<User> {
  // Per address; per account and address, so one person can't lock an owner
  // out by guessing; and a looser cap per account, so a botnet can't grind
  // one password. One database write for all three.
  await rateLimitMany([
    { key: `login:${ip}`, limit: 20 },
    { key: `login:${input.email}:${ip}`, limit: 10, windowMs: 15 * 60_000 },
    { key: `login:${input.email}`, limit: 100, windowMs: 60 * 60_000 },
  ]);
  const found = await findUserCredentials(input.email);
  const ok = await verifyPassword(input.password, found?.passwordHash ?? (await dummyPasswordHash()));
  if (!found || !ok) throw new ServiceError(401, "That email and password don't match");
  if (found.user.blocked) throw new ServiceError(403, `This account has been blocked. Email ${BRAND.supportEmail} if you think that's a mistake.`);
  await createSession(found.user.id);
  return found.user;
}

/**
 * Where a fresh sign-in lands, so it doesn't stop at /dashboard only to be
 * sent on: the venue last open on this device (if it's one of theirs), or
 * their only venue. Anything else is for /dashboard to sort out.
 */
export async function homeAfterLogin(userId: string, lastVenueId: string | undefined): Promise<string> {
  const memberships = await membershipsOf(userId);
  const managed = memberships.filter((m) => m.role !== "staff").map((m) => m.venueId);
  if (lastVenueId && managed.includes(lastVenueId)) return `/dashboard/${lastVenueId}`;
  if (managed.length === 1 && memberships.length === 1) return `/dashboard/${managed[0]}`;
  return "/dashboard";
}

export async function logout() {
  await destroySession();
}

/** Always succeeds from the caller's view, so it can't be used to discover accounts. */
export async function requestPasswordReset(email: string, origin: string) {
  await rateLimitKey(`reset:${email}`, 3, 15 * 60_000);
  const found = await findUserCredentials(email);
  if (!found || found.user.blocked) return;
  // Sent after the response, so an existing account takes no longer to answer than a missing one.
  await afterResponse("password reset email", () => sendPasswordResetEmail(found.user, origin));
}

export async function sendPasswordResetEmail(user: User, origin: string) {
  const token = await createAuthToken(user.id, "reset_password", 60);
  await sendMail({
    to: user.email,
    subject: `Reset your ${BRAND.name} password`,
    text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your password. Choose a new one here:\n${origin}/reset-password?token=${encodeURIComponent(token)}\n\nThe link works for one hour. If you didn't ask, ignore this email and your password stays the same.\n\n${BRAND.name}`,
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeAuthToken(token, "reset_password");
  if (!userId) throw new ServiceError(400, "This reset link has expired or was already used. Ask for a new one.");
  await updatePasswordHash(userId, await hashPassword(password));
  // The link went to their inbox, so the address is proven too.
  await markEmailVerified(userId);
  await destroyAllSessions(userId);
  await createSession(userId);
}

export async function verifyEmail(token: string): Promise<boolean> {
  const userId = await consumeAuthToken(token, "verify_email");
  if (!userId) return false;
  await markEmailVerified(userId);
  return true;
}

export async function changePassword(user: User, input: z.output<typeof changePasswordRequest>) {
  await rateLimitKey(`password:${user.id}`, 5, 15 * 60_000);
  const hash = await findPasswordHash(user.id);
  if (!hash || !(await verifyPassword(input.currentPassword, hash))) throw new ServiceError(400, "Your current password isn't right");
  await updatePasswordHash(user.id, await hashPassword(input.newPassword));
  await destroyOtherSessions(user.id);
}

/** Deletes the account and every venue it alone owns, with those venues' guest data. */
export async function deleteAccount(user: User, password: string) {
  await rateLimitKey(`delete:${user.id}`, 5, 15 * 60_000);
  const hash = await findPasswordHash(user.id);
  if (!hash || !(await verifyPassword(password, hash))) throw new ServiceError(400, "That password isn't right");
  await removeAccount(user.id);
  await destroySession();
}

/** The account, its sessions and every venue it alone owns. Returns how many venues went with it. */
export async function removeAccount(userId: string): Promise<number> {
  const venues = await venuesOwnedSolelyBy(userId);
  for (const venueId of venues) {
    await stopBilling(venueId);
    await disconnectGoogle(venueId);
    await deleteVenue(venueId);
  }
  (await (await getDb()).run("DELETE FROM users WHERE id = ?", userId));
  return venues.length;
}
