import { z } from "zod";

const nullableString = (max: number) => z.string().trim().max(max).nullable().optional();
const nullableStringArray = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .nullable()
  .optional();

const selectValue = (values: readonly [string, ...string[]]) =>
  z.enum(values).nullable().optional();

const notificationTypes = z
  .array(z.enum(["BEFORE_15", "BEFORE_5", "ON_COMPLETE", "HOURLY"]))
  .max(4)
  .nullable()
  .optional();

export const settingsUpdateSchema = z.object({
  timezoneOverride: z.string().trim().max(80).nullable().optional(),
  timeFormat: z.enum(["12", "24"]).optional(),
  measurementUnit: z.enum(["METRIC", "IMPERIAL"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  notificationTypes,
  notificationFrequency: z.enum(["ALL", "IMPORTANT", "MUTED"]).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  voiceEnabled: z.boolean().optional(),
  notifyVolume: z.number().int().min(0).max(100).optional(),
  notificationVoice: z.string().trim().max(80).nullable().optional(),
  generationPersonalization: z.number().int().min(0).max(100).optional(),
  avoidRecentActivities: z.boolean().optional(),
  recentActivitiesWindow: z.enum(["3", "7", "14", "30"]).or(z.number().int().refine((value) => [3, 7, 14, 30].includes(value))).optional(),
  includeCompletedHistory: z.boolean().optional(),
  profileVisibility: z.enum(["PRIVATE", "PUBLIC"]).optional(),
  aiProvider: z.enum(["NVIDIA_NIM", "OPENROUTER", "OPENAI", "ANTHROPIC", "GOOGLE_GEMINI", "OLLAMA", "CUSTOM", "OPENCODE"]).nullable().optional(),
  aiModel: z.string().trim().max(160).nullable().optional(),
  aiBaseUrl: z.string().trim().url().max(500).nullable().optional(),
  aiTemperature: z.number().min(0).max(2).optional(),
  aiMaxTokens: z.number().int().min(1).max(8192).optional(),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).nullable().optional(),
    genderIdentity: selectValue(["MAN", "WOMAN", "NON_BINARY", "PREFER_NOT_TO_SAY", "OTHER"]),
    fitnessLevel: selectValue(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    physicalLimitations: nullableString(500),
    exerciseIntensity: selectValue(["GENTLE", "MODERATE", "INTENSE"]),
    skillsWithExperience: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          experience: z.enum(["BASIC", "INTERMEDIATE", "EXPERT"]),
        }),
      )
      .max(30)
      .nullable()
      .optional(),
    hobbies: nullableStringArray,
    sports: nullableStringArray,
    creativeActivities: nullableStringArray,
    learningInterests: nullableStringArray,
    preferredActivityTypes: nullableStringArray,
    preferredDuration: selectValue(["15", "30", "45", "60", "90", "FLEXIBLE"]),
    preferredTimesOfDay: nullableStringArray,
    soloGroupPreference: selectValue(["SOLO", "GROUP", "INDIFFERENT"]),
    energyLevel: selectValue(["LOW", "MEDIUM", "HIGH"]),
    indoorOutdoorPreference: selectValue(["INDOOR", "OUTDOOR", "INDIFFERENT"]),
    activityBudget: selectValue(["FREE", "LOW", "MEDIUM", "HIGH", "UNLIMITED"]),
    workStudyStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    workStudyEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    freeDays: nullableStringArray,
    dailyAvailableMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
    resourcesAccess: nullableStringArray,
    mainGoals: z.array(z.string().trim().min(1).max(160)).max(5).nullable().optional(),
    shortTermGoals: nullableString(1000),
    motivationLevel: z.number().int().min(1).max(10).nullable().optional(),
    country: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    language: z.enum(["es", "en"]).optional(),
    theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
    operationMode: z.enum(["SYNCHRONOUS", "FREE"]).optional(),
    ...settingsUpdateSchema.shape,
  })
  .passthrough();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
