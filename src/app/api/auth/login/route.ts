import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/data";
import { createSession, verifyPassword } from "@/lib/auth";
import { credentialsSchema } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

const zBoolean = z.boolean().optional();

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const parsed = credentialsSchema.extend({ remember: zBoolean }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const { email, password, remember } = parsed.data;
  const now = Date.now();
  const current = attempts.get(email);
  if (current && current.resetAt > now && current.count >= 8) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }
  const user = await findUserByEmail(email);
  const valid = Boolean(user?.passwordHash) && await verifyPassword(password, user?.passwordHash ?? "");
  if (!user || !valid) {
    const next = current && current.resetAt > now ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: now + 10 * 60_000 };
    attempts.set(email, next);
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  attempts.delete(email);
  await createSession(user.id, remember !== false);
  return NextResponse.json({ ok: true, onboardingRequired: !user.onboardingCompleted });
}