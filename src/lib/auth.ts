import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
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
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { lastAccessAt: new Date() } }).catch(() => undefined);
  return session.user;
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
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
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
  await prisma.session.deleteMany({ where: { userId } });
}
