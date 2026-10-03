import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, invalidateUserSessions, requireUser, verifyPassword } from "@/lib/auth";
import { updateUser } from "@/lib/data";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Las contraseñas nuevas no coinciden.",
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "La contraseña no es válida." }, { status: 400 });
  if (!user.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual no es válida." }, { status: 401 });
  }
  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return NextResponse.json({ error: "La nueva contraseña debe ser diferente." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await updateUser(user.id, { passwordHash });
  await invalidateUserSessions(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}