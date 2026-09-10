import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const MAX_SIZE = 5 * 1024 * 1024;
const types = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !types.has(file.type) || file.size > MAX_SIZE || file.size === 0) {
      return NextResponse.json({ error: "La imagen debe ser JPG, PNG o WebP y pesar hasta 5 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const validSignature =
      (file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.type === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP");
    if (!validSignature) return NextResponse.json({ error: "El archivo no parece ser una imagen válida." }, { status: 400 });
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${user.id}-${Date.now()}-${randomBytes(6).toString("hex")}.${types.get(file.type)}`;
    await writeFile(path.join(dir, filename), bytes, { flag: "wx" });
    const avatarUrl = `/uploads/${filename}`;
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    return NextResponse.json({ avatarUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    console.error("Avatar upload failed:", error);
    return NextResponse.json({ error: "No se pudo guardar la imagen." }, { status: 500 });
  }
}
