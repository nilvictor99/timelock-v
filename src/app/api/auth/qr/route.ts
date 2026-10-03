import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { deleteUnusedQrTokens, createQrToken } from "@/lib/data";
import { requireUser } from "@/lib/auth";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
  try {
    const user = await requireUser();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await deleteUnusedQrTokens(user.id);
    await createQrToken(user.id, hash(token), expiresAt);
    return NextResponse.json({ token, expiresAt }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sesión no válida." }, { status: 401, headers: noStoreHeaders });
    return NextResponse.json({ error: "No se pudo generar el QR." }, { status: 500, headers: noStoreHeaders });
  }
}