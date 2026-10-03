-- TimeLock-v: Initial schema migration
-- Creates all tables for the application

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'MISSED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE theme AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE operation_mode AS ENUM ('SYNCHRONOUS', 'FREE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT 'Mi espacio',
  email TEXT UNIQUE,
  password_hash TEXT,
  avatar_url TEXT,
  country TEXT,
  city TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  operation_mode operation_mode NOT NULL DEFAULT 'SYNCHRONOUS',
  birth_date TIMESTAMPTZ,
  gender_identity TEXT,
  fitness_level TEXT,
  physical_limitations TEXT,
  exercise_intensity TEXT,
  skills_with_experience JSONB,
  hobbies JSONB,
  sports JSONB,
  creative_activities JSONB,
  learning_interests JSONB,
  preferred_activity_types JSONB,
  preferred_duration TEXT,
  preferred_times_of_day JSONB,
  solo_group_preference TEXT,
  energy_level TEXT,
  indoor_outdoor_preference TEXT,
  activity_budget TEXT,
  work_study_start TEXT,
  work_study_end TEXT,
  free_days JSONB,
  occupation TEXT,
  bio TEXT,
  interests TEXT,
  goals TEXT,
  work_hours TEXT,
  daily_available_minutes INTEGER,
  resources_access JSONB,
  main_goals JSONB,
  short_term_goals TEXT,
  motivation_level INTEGER,
  theme theme NOT NULL DEFAULT 'SYSTEM',
  language TEXT NOT NULL DEFAULT 'es',
  timezone_override TEXT,
  time_format TEXT NOT NULL DEFAULT '24',
  measurement_unit TEXT NOT NULL DEFAULT 'METRIC',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_types JSONB,
  notification_frequency TEXT NOT NULL DEFAULT 'ALL',
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  notify_volume INTEGER NOT NULL DEFAULT 70,
  notification_voice TEXT,
  generation_personalization INTEGER NOT NULL DEFAULT 70,
  avoid_recent_activities BOOLEAN NOT NULL DEFAULT false,
  recent_activities_window INTEGER NOT NULL DEFAULT 7,
  include_completed_history BOOLEAN NOT NULL DEFAULT true,
  profile_visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  ai_provider TEXT,
  ai_model TEXT,
  ai_base_url TEXT,
  ai_temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ai_max_tokens INTEGER NOT NULL DEFAULT 500,
  pause_active BOOLEAN NOT NULL DEFAULT false,
  pause_reason TEXT,
  pause_starts_at TIMESTAMPTZ,
  pause_ends_at TIMESTAMPTZ,
  points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#111111',
  points_per_hour INTEGER NOT NULL DEFAULT 5,
  UNIQUE(user_id, name)
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status activity_status NOT NULL DEFAULT 'PLANNED',
  points INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities(user_id, start_at);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cost INTEGER NOT NULL,
  description TEXT,
  redeemed_at TIMESTAMPTZ
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- QR Login Tokens
CREATE TABLE IF NOT EXISTS qr_login_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_user ON qr_login_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_login_tokens(expires_at);

-- Suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  duration INTEGER NOT NULL,
  reason TEXT NOT NULL,
  points INTEGER NOT NULL,
  suggested_time TEXT,
  source TEXT NOT NULL DEFAULT 'rule',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_created ON suggestions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_gen ON suggestions(user_id, generation_id);

-- DOWN
DROP TABLE IF EXISTS suggestions;
DROP TABLE IF EXISTS qr_login_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS rewards;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS operation_mode;
DROP TYPE IF EXISTS theme;
DROP TYPE IF EXISTS activity_status;
