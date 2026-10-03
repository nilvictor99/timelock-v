import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  createSessionRow,
  findSessionWithUser,
  deleteSessionByTokenHash,
  deleteSessionsByUser,
  touchLastAccess,
} from "@/lib/data";

export const SESSION_COOKIE = "timelock_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string, remember = true) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS : 1) * 86_400_000);
  await createSessionRow(userId, hashToken(token), expiresAt);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
  return expiresAt;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const record = await findSessionWithUser(hashToken(token));
  if (!record) return null;
  const { session, user } = record;
  if (session.expiresAt <= new Date()) {
    await deleteSessionByTokenHash(hashToken(token)).catch(() => undefined);
    return null;
  }
  await touchLastAccess(user.id);
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function deleteCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSessionByTokenHash(hashToken(token));
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function invalidateUserSessions(userId: string) {
  await deleteSessionsByUser(userId);
}