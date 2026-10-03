-- TimeLock-v: migra datos del esquema Prisma (camelCase) al nuevo esquema snake_case.
-- Solo actúa si existen las tablas antiguas creadas por Prisma ("User", "Activity", ...).
-- En una base nueva sin Prisma este archivo es un no-op seguro.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    INSERT INTO users (
      id, name, email, password_hash, avatar_url, country, city, onboarding_completed,
      timezone, operation_mode, birth_date, gender_identity, fitness_level, physical_limitations,
      exercise_intensity, skills_with_experience, hobbies, sports, creative_activities, learning_interests,
      preferred_activity_types, preferred_duration, preferred_times_of_day, solo_group_preference,
      energy_level, indoor_outdoor_preference, activity_budget, work_study_start, work_study_end,
      free_days, occupation, bio, interests, goals, work_hours, daily_available_minutes,
      resources_access, main_goals, short_term_goals, motivation_level, theme, language, timezone_override,
      time_format, measurement_unit, notifications_enabled, notification_types, notification_frequency,
      quiet_hours_start, quiet_hours_end, voice_enabled, notify_volume, notification_voice,
      generation_personalization, avoid_recent_activities, recent_activities_window, include_completed_history,
      profile_visibility, ai_provider, ai_model, ai_base_url, ai_temperature, ai_max_tokens,
      pause_active, pause_reason, pause_starts_at, pause_ends_at, points, current_streak, best_streak,
      created_at, last_access_at, updated_at
    )
    SELECT
      id, name, email, "passwordHash", "avatarUrl", country, city, "onboardingCompleted",
      timezone, "operationMode"::text::operation_mode, "birthDate", "genderIdentity", "fitnessLevel", "physicalLimitations",
      "exerciseIntensity", "skillsWithExperience", hobbies, sports, "creativeActivities", "learningInterests",
      "preferredActivityTypes", "preferredDuration", "preferredTimesOfDay", "soloGroupPreference",
      "energyLevel", "indoorOutdoorPreference", "activityBudget", "workStudyStart", "workStudyEnd",
      "freeDays", occupation, bio, interests, goals, "workHours", "dailyAvailableMinutes",
      "resourcesAccess", "mainGoals", "shortTermGoals", "motivationLevel", theme::text::theme, language, "timezoneOverride",
      "timeFormat", "measurementUnit", "notificationsEnabled", "notificationTypes", "notificationFrequency",
      "quietHoursStart", "quietHoursEnd", "voiceEnabled", "notifyVolume", "notificationVoice",
      "generationPersonalization", "avoidRecentActivities", "recentActivitiesWindow", "includeCompletedHistory",
      "profileVisibility", "aiProvider", "aiModel", "aiBaseUrl", "aiTemperature", "aiMaxTokens",
      "pauseActive", "pauseReason", "pauseStartsAt", "pauseEndsAt", points, "currentStreak", "bestStreak",
      "createdAt", "lastAccessAt", "updatedAt"
    FROM "User"
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Category') THEN
    INSERT INTO categories (id, user_id, name, color, points_per_hour)
    SELECT id, "userId", name, color, "pointsPerHour" FROM "Category"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Activity') THEN
    INSERT INTO activities (
      id, user_id, category_id, title, description, date, start_at, end_at, status,
      points, is_free, completed_at, created_at, updated_at
    )
    SELECT
      id, "userId", "categoryId", title, description, date, "startAt", "endAt", status::text::activity_status,
      points, "isFree", "completedAt", "createdAt", "updatedAt"
    FROM "Activity"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Reward') THEN
    INSERT INTO rewards (id, user_id, title, cost, description, redeemed_at)
    SELECT id, "userId", title, cost, description, "redeemedAt" FROM "Reward"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Session') THEN
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    SELECT id, "userId", "tokenHash", "expiresAt", "createdAt" FROM "Session"
    ON CONFLICT (token_hash) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'QrLoginToken') THEN
    INSERT INTO qr_login_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
    SELECT id, "userId", "tokenHash", "expiresAt", "usedAt", "createdAt" FROM "QrLoginToken"
    ON CONFLICT (token_hash) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Suggestion') THEN
    INSERT INTO suggestions (id, user_id, generation_id, title, category, duration, reason, points, suggested_time, source, created_at)
    SELECT id, "userId", "generationId", title, category, duration, reason, points, "suggestedTime", source, "createdAt" FROM "Suggestion"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Limpieza de las tablas y enums antiguos de Prisma.
DROP TABLE IF EXISTS "Suggestion";
DROP TABLE IF EXISTS "QrLoginToken";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "Reward";
DROP TABLE IF EXISTS "Activity";
DROP TABLE IF EXISTS "Category";
DROP TABLE IF EXISTS "User";
DROP TYPE IF EXISTS "ActivityStatus";
DROP TYPE IF EXISTS "Theme";
DROP TYPE IF EXISTS "OperationMode";

-- DOWN
-- Las tablas antiguas de Prisma no se restauran de forma automática.
-- Para regenerar el esquema desde cero: npm run db:refresh