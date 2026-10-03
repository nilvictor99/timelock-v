import { NextResponse } from "next/server";
import { createUserWithDefaults, findUserByEmail } from "@/lib/data";
import { createSession, hashPassword } from "@/lib/auth";
import { registrationSchema } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const { email, password, name, remember } = parsed.data;
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    }
    const user = await createUserWithDefaults({
      email,
      name,
      passwordHash: await hashPassword(password),
      defaultCategories: [
        { name: "Estudio", color: "#2563eb", pointsPerHour: 5 },
        { name: "Deporte", color: "#16a34a", pointsPerHour: 8 },
        { name: "Personal", color: "#ea580c", pointsPerHour: 4 },
        { name: "Descanso", color: "#7c3aed", pointsPerHour: 3 }
      ],
      defaultRewards: [
        { title: "30 min de serie", cost: 30 },
        { title: "Videojuegos", cost: 80 },
        { title: "Salir a caminar", cost: 50 }
      ]
    });
    await createSession(user.id, remember !== false);
    return NextResponse.json({ ok: true, onboardingRequired: true }, { status: 201 });
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}