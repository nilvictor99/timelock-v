import { NextResponse } from "next/server";
import { requireUser, deleteCurrentSession } from "@/lib/auth";
import { toDateKey } from "@/lib/utils";
import { profileUpdateSchema, settingsUpdateSchema } from "@/lib/profile-validation";
import {
  findActivitiesByUser,
  findCategoriesByUser,
  findRewardsByUser,
  findCategoryByIdAndUser,
  createActivity,
  createReward,
  updateUser,
  deleteUser,
  incrementUserPoints,
  findActivityByIdAndUser,
  updateActivity,
  findPlannedActivitiesAfter,
  updateActivityTimes,
  deleteActivityByIdAndUser,
} from "@/lib/data";

export const dynamic = "force-dynamic";

function publicUser(user: any) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function authenticated() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function GET() {
  let user = await authenticated();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  try {
    if (user.pauseActive && user.pauseEndsAt && new Date(user.pauseEndsAt) <= new Date()) {
      user = await updateUser(user.id, { pauseActive: false, pauseReason: null, pauseStartsAt: null, pauseEndsAt: null });
    }
    const [activities, categories, rewards] = await Promise.all([
      findActivitiesByUser(user.id),
      findCategoriesByUser(user.id),
      findRewardsByUser(user.id)
    ]);
    return NextResponse.json({ user: publicUser(user), activities, categories, rewards, today: toDateKey() });
  } catch (error) {
    console.error("TimeLock-v database bootstrap failed:", error);
    return NextResponse.json({ error: "La base de datos no está disponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await authenticated();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "activity") {
    const start = body.startAt ? new Date(body.startAt) : new Date();
    const end = body.endAt ? new Date(body.endAt) : new Date(start.getTime() + 60 * 60_000);
    if (!body.title?.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Título y horario válido son obligatorios." }, { status: 400 });
    }
    const category = body.categoryId
      ? await findCategoryByIdAndUser(body.categoryId, user.id)
      : null;
    const points = category ? Math.max(1, Math.round(((end.getTime() - start.getTime()) / 3_600_000) * category.pointsPerHour)) : 0;
    const activity = await createActivity({
      userId: user.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      categoryId: category?.id ?? null,
      date: start,
      startAt: start,
      endAt: end,
      isFree: user.operationMode === "FREE" || Boolean(body.isFree),
      points
    });
    return NextResponse.json(activity, { status: 201 });
  }

  if (body.action === "reward") {
    const cost = Number(body.cost);
    if (!body.title?.trim() || !Number.isInteger(cost) || cost < 1) {
      return NextResponse.json({ error: "La recompensa y su coste son obligatorios." }, { status: 400 });
    }
    const reward = await createReward({ userId: user.id, title: body.title.trim(), cost, description: body.description?.trim() || null });
    return NextResponse.json(reward, { status: 201 });
  }

  if (body.action === "settings" || body.action === "onboarding") {
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Revisa los datos del perfil.", issues: parsed.error.flatten() }, { status: 400 });
    }
    const parsedSettings = settingsUpdateSchema.safeParse(body);
    if (!parsedSettings.success) {
      return NextResponse.json({ error: "Revisa las preferencias de ajustes.", issues: parsedSettings.error.flatten() }, { status: 400 });
    }
    const profile = parsed.data;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const nullable = <K extends keyof typeof profile>(key: K) => has(String(key)) ? (profile[key] ?? null) : undefined;
    const jsonNullable = <K extends keyof typeof profile>(key: K) =>
      has(String(key)) ? (profile[key] ?? null) : undefined;
    const operationMode = body.operationMode === "FREE" ? "FREE" : body.operationMode === "SYNCHRONOUS" ? "SYNCHRONOUS" : undefined;
    const data: Record<string, unknown> = {
      name: profile.name,
      birthDate: has("birthDate") ? (profile.birthDate ? new Date(`${profile.birthDate}T00:00:00.000Z`) : null) : undefined,
      genderIdentity: nullable("genderIdentity"),
      fitnessLevel: nullable("fitnessLevel"),
      physicalLimitations: nullable("physicalLimitations"),
      exerciseIntensity: nullable("exerciseIntensity"),
      skillsWithExperience: jsonNullable("skillsWithExperience"),
      hobbies: jsonNullable("hobbies"),
      sports: jsonNullable("sports"),
      creativeActivities: jsonNullable("creativeActivities"),
      learningInterests: jsonNullable("learningInterests"),
      preferredActivityTypes: jsonNullable("preferredActivityTypes"),
      preferredDuration: nullable("preferredDuration"),
      preferredTimesOfDay: jsonNullable("preferredTimesOfDay"),
      soloGroupPreference: nullable("soloGroupPreference"),
      energyLevel: nullable("energyLevel"),
      indoorOutdoorPreference: nullable("indoorOutdoorPreference"),
      activityBudget: nullable("activityBudget"),
      workStudyStart: nullable("workStudyStart"),
      workStudyEnd: nullable("workStudyEnd"),
      freeDays: jsonNullable("freeDays"),
      occupation: has("occupation") ? (typeof body.occupation === "string" && body.occupation.trim() ? body.occupation.trim() : null) : undefined,
      bio: has("bio") ? (typeof body.bio === "string" && body.bio.trim() ? body.bio.trim() : null) : undefined,
      interests: has("interests") ? (typeof body.interests === "string" && body.interests.trim() ? body.interests.trim() : null) : undefined,
      goals: has("goals") ? (typeof body.goals === "string" && body.goals.trim() ? body.goals.trim() : null) : undefined,
      workHours: has("workHours") ? (typeof body.workHours === "string" && body.workHours.trim() ? body.workHours.trim() : null) : undefined,
      dailyAvailableMinutes: profile.dailyAvailableMinutes,
      resourcesAccess: jsonNullable("resourcesAccess"),
      mainGoals: jsonNullable("mainGoals"),
      shortTermGoals: nullable("shortTermGoals"),
      motivationLevel: nullable("motivationLevel"),
      theme: ["DARK", "LIGHT", "SYSTEM"].includes(body.theme) ? body.theme : undefined,
      language: profile.language,
      timezone: profile.timezone,
      operationMode,
      timezoneOverride: nullable("timezoneOverride"),
      timeFormat: profile.timeFormat,
      measurementUnit: profile.measurementUnit,
      notificationsEnabled: profile.notificationsEnabled,
      notificationTypes: jsonNullable("notificationTypes"),
      notificationFrequency: profile.notificationFrequency,
      quietHoursStart: nullable("quietHoursStart"),
      quietHoursEnd: nullable("quietHoursEnd"),
      voiceEnabled: typeof body.voiceEnabled === "boolean" ? body.voiceEnabled : undefined,
      notifyVolume: Number.isInteger(body.notifyVolume) ? Math.min(100, Math.max(0, body.notifyVolume)) : undefined,
      notificationVoice: nullable("notificationVoice"),
      generationPersonalization: profile.generationPersonalization,
      avoidRecentActivities: profile.avoidRecentActivities,
      recentActivitiesWindow: typeof profile.recentActivitiesWindow === "string" ? Number(profile.recentActivitiesWindow) : profile.recentActivitiesWindow,
      includeCompletedHistory: profile.includeCompletedHistory,
      profileVisibility: profile.profileVisibility,
      aiProvider: nullable("aiProvider"),
      aiModel: nullable("aiModel"),
      aiBaseUrl: nullable("aiBaseUrl"),
      aiTemperature: profile.aiTemperature,
      aiMaxTokens: profile.aiMaxTokens,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined,
      country: profile.country,
      city: profile.city,
      onboardingCompleted: body.action === "onboarding" ? true : undefined
    };
    const updated = await updateUser(user.id, data);
    return NextResponse.json(publicUser(updated));
  }

  if (body.action === "pause") {
    const active = Boolean(body.active);
    const startsAt = active ? new Date() : null;
    const endsAt = active && body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "La fecha de reanudación no es válida." }, { status: 400 });
    }
    if (!active && user.pauseActive && user.pauseStartsAt) {
      const elapsed = Math.max(0, Date.now() - new Date(user.pauseStartsAt).getTime());
      const planned = await findPlannedActivitiesAfter(user.id, new Date(user.pauseStartsAt));
      await Promise.all(planned.map((activity) => updateActivityTimes(
        activity.id,
        new Date(new Date(activity.date).getTime() + elapsed),
        new Date(new Date(activity.startAt).getTime() + elapsed),
        new Date(new Date(activity.endAt).getTime() + elapsed)
      )));
    }
    const updated = await updateUser(user.id, {
      pauseActive: active,
      pauseReason: active ? (typeof body.reason === "string" ? body.reason.trim().slice(0, 120) || null : null) : null,
      pauseStartsAt: startsAt,
      pauseEndsAt: endsAt
    });
    return NextResponse.json(publicUser(updated));
  }

  return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await authenticated();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const affected = await deleteActivityByIdAndUser(id, user.id);
    if (!affected) return NextResponse.json({ error: "La actividad ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!user.email || email !== user.email || body.confirmation !== "DELETE_ACCOUNT") {
    return NextResponse.json({ error: "La confirmación de eliminación no es válida." }, { status: 400 });
  }
  await deleteUser(user.id);
  await deleteCurrentSession();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await authenticated();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  try {
    const existing = await findActivityByIdAndUser(body.id, user.id);
    if (!existing) return NextResponse.json({ error: "La actividad ya no existe." }, { status: 404 });
    const activity = await updateActivity(body.id, user.id, {
      status: body.status,
      completedAt: body.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined
    });
    if (body.status === "COMPLETED" && existing.status !== "COMPLETED") {
      await incrementUserPoints(user.id, activity?.points ?? 0);
    }
    return NextResponse.json(activity);
  } catch (error) {
    console.error("Activity update failed:", error);
    return NextResponse.json({ error: "No se pudo actualizar la actividad." }, { status: 500 });
  }
}