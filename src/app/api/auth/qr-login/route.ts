import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ error: "QR no válido." }, { status: 400, headers: noStoreHeaders });
  const record = await prisma.qrLoginToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return NextResponse.json({ error: "El QR ha caducado o ya fue utilizado." }, { status: 401, headers: noStoreHeaders });
  }
  const consumed = await prisma.qrLoginToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() }
  });
  if (!consumed.count) return NextResponse.json({ error: "El QR ya fue utilizado." }, { status: 401, headers: noStoreHeaders });
  await createSession(record.userId, true);
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
