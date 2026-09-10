import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createSession, invalidateUserSessions, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  currentPassword: z.string().min(1),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
  const parsed = emailChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Introduce un correo válido y tu contraseña actual." }, { status: 400 });
  if (!user.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual no es válida." }, { status: 401 });
  }
  if (parsed.data.email === user.email) return NextResponse.json({ error: "El correo nuevo debe ser diferente." }, { status: 400 });

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { email: parsed.data.email },
      select: { id: true },
    });
    await invalidateUserSessions(updated.id);
    await createSession(updated.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese correo ya está en uso." }, { status: 409 });
    }
    console.error("Email change failed:", error);
    return NextResponse.json({ error: "No se pudo actualizar el correo." }, { status: 500 });
  }
}
