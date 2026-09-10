import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const fromValue = params.get("from");
    const toValue = params.get("to");
    const dateQuery = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).safeParse({ from: fromValue ?? undefined, to: toValue ?? undefined });
    if (!dateQuery.success) return NextResponse.json({ error: "Rango de fechas no válido." }, { status: 400 });
    const from = dateQuery.data.from ? new Date(`${dateQuery.data.from}T00:00:00.000Z`) : null;
    const to = dateQuery.data.to ? new Date(`${dateQuery.data.to}T23:59:59.999Z`) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return NextResponse.json({ error: "Rango de fechas no válido." }, { status: 400 });
    }
    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        ...(from || to ? { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
      },
      include: { category: true },
      orderBy: { startAt: "asc" }
    });
    const format = params.get("format") ?? "csv";
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      country: user.country,
      city: user.city,
      timezone: user.timezone,
      language: user.language,
      settings: {
        theme: user.theme,
        operationMode: user.operationMode,
        timezoneOverride: user.timezoneOverride,
        timeFormat: user.timeFormat,
        measurementUnit: user.measurementUnit,
        notificationsEnabled: user.notificationsEnabled,
        notificationTypes: user.notificationTypes,
        notificationFrequency: user.notificationFrequency,
        quietHoursStart: user.quietHoursStart,
        quietHoursEnd: user.quietHoursEnd,
        voiceEnabled: user.voiceEnabled,
        notifyVolume: user.notifyVolume,
        notificationVoice: user.notificationVoice,
        generationPersonalization: user.generationPersonalization,
        avoidRecentActivities: user.avoidRecentActivities,
        recentActivitiesWindow: user.recentActivitiesWindow,
        includeCompletedHistory: user.includeCompletedHistory,
        profileVisibility: user.profileVisibility,
        aiProvider: user.aiProvider,
        aiModel: user.aiModel,
        aiBaseUrl: user.aiBaseUrl,
        aiTemperature: user.aiTemperature,
        aiMaxTokens: user.aiMaxTokens,
      },
    };
    if (format === "json") {
      return NextResponse.json({ user: safeUser, activities });
    }
    const csv = [
      "Actividad,Categoria,Inicio,Fin,Estado,Puntos",
      ...activities.map((a) => [a.title, a.category?.name ?? "Sin categoría", a.startAt.toISOString(), a.endAt.toISOString(), a.status, a.points].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    ].join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=timelock-export.csv" } });
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
}
