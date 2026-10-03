import { query, queryOne, queryMany, transaction } from "./db";

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function toCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function mapRow<T = any>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

export function mapRows<T = any>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => mapRow<T>(r));
}

/** Converts camelCase keys to snake_case (userId -> user_id). */
export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Builds a dynamic UPDATE fragment. Only entries with defined values are included. */
export function buildUpdate(data: Record<string, unknown>, startIdx = 1) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = startIdx;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    params.push(v === null ? null : v);
    sets.push(`${camelToSnake(k)} = $${idx++}`);
  }
  return { sets, params };
}

function val(v: unknown): unknown {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

/* ---------------------------------------------------------------- */
/* Constants                                                        */
/* ---------------------------------------------------------------- */

const USER_COLUMNS = `
  id, name, email, password_hash, avatar_url, country, city,
  onboarding_completed, timezone, operation_mode, birth_date,
  gender_identity, fitness_level, physical_limitations, exercise_intensity,
  skills_with_experience, hobbies, sports, creative_activities, learning_interests,
  preferred_activity_types, preferred_duration, preferred_times_of_day,
  solo_group_preference, energy_level, indoor_outdoor_preference, activity_budget,
  work_study_start, work_study_end, free_days, occupation, bio, interests, goals,
  work_hours, daily_available_minutes, resources_access, main_goals,
  short_term_goals, motivation_level, theme, language, timezone_override,
  time_format, measurement_unit, notifications_enabled, notification_types,
  notification_frequency, quiet_hours_start, quiet_hours_end, voice_enabled,
  notify_volume, notification_voice, generation_personalization,
  avoid_recent_activities, recent_activities_window, include_completed_history,
  profile_visibility, ai_provider, ai_model, ai_base_url, ai_temperature,
  ai_max_tokens, pause_active, pause_reason, pause_starts_at, pause_ends_at,
  points, current_streak, best_streak, created_at, last_access_at, updated_at
`;

export async function findUserByEmail(email: string) {
  const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
  return row ? mapRow(row) : null;
}

export async function findUserById(id: string) {
  const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return row ? mapRow(row) : null;
}

export async function createUserWithDefaults(data: {
  email: string;
  name: string;
  passwordHash: string;
  defaultCategories: Array<{ name: string; color: string; pointsPerHour: number }>;
  defaultRewards: Array<{ title: string; cost: number }>;
}) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
      [data.email, data.name, data.passwordHash]
    );
    const user = mapRow(rows[0]);

    for (const cat of data.defaultCategories) {
      await client.query(
        `INSERT INTO categories (user_id, name, color, points_per_hour)
         VALUES ($1, $2, $3, $4)`,
        [user.id, cat.name, cat.color, cat.pointsPerHour]
      );
    }
    for (const rw of data.defaultRewards) {
      await client.query(
        `INSERT INTO rewards (user_id, title, cost) VALUES ($1, $2, $3)`,
        [user.id, rw.title, rw.cost]
      );
    }
    return user;
  });
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const mapped = val(v);
    if (mapped !== undefined) clean[k] = mapped;
  }
  clean.updated_at = new Date();
  const { sets, params } = buildUpdate(clean);
  if (sets.length === 0) return findUserById(id);
  const row = await queryOne(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length + 1} RETURNING ${USER_COLUMNS}`,
    [...params, id]
  );
  return row ? mapRow(row) : null;
}

export async function deleteUser(id: string) {
  await query(`DELETE FROM users WHERE id = $1`, [id]);
}

export async function incrementUserPoints(userId: string, points: number) {
  await query(
    `UPDATE users SET points = points + $1, updated_at = now() WHERE id = $2`,
    [points, userId]
  );
}

export async function touchLastAccess(userId: string) {
  await query(`UPDATE users SET last_access_at = now(), updated_at = now() WHERE id = $1`, [userId]).catch(
    () => undefined
  );
}

/* ---------------------------------------------------------------- */
/* Sessions                                                         */
/* ---------------------------------------------------------------- */

const SESSION_COLUMNS = `id, user_id, token_hash, expires_at, created_at`;

export async function createSessionRow(userId: string, tokenHash: string, expiresAt: Date) {
  const row = await queryOne(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING ${SESSION_COLUMNS}`,
    [userId, tokenHash, expiresAt]
  );
  return row ? mapRow(row) : null;
}

export async function findSessionWithUser(tokenHash: string) {
  const row = await queryOne(
    `SELECT s.id as s_id, s.user_id, s.token_hash, s.expires_at as s_expires_at, ${USER_COLUMNS.split(",").map((c) => `u.${c.trim()} as u_${c.trim()}`).join(", ")}
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );
  if (!row) return null;
  const user: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith("u_")) user[k.slice(2)] = v;
  }
  const session = {
    id: row.s_id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.s_expires_at,
  };
  return { session, user: mapRow(user) };
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

export async function deleteSessionsByUser(userId: string) {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/* ---------------------------------------------------------------- */
/* Categories                                                       */
/* ---------------------------------------------------------------- */

const CATEGORY_COLUMNS = `id, user_id, name, color, points_per_hour`;

export async function findCategoriesByUser(userId: string) {
  const rows = await queryMany(
    `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  return mapRows(rows);
}

export async function findCategoryByIdAndUser(categoryId: string, userId: string) {
  const row = await queryOne(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = $1 AND user_id = $2`, [
    categoryId,
    userId,
  ]);
  return row ? mapRow(row) : null;
}

/* ---------------------------------------------------------------- */
/* Activities                                                       */
/* ---------------------------------------------------------------- */

const ACTIVITY_COLUMNS = `
  a.id, a.user_id, a.category_id, a.title, a.description, a.date, a.start_at, a.end_at,
  a.status, a.points, a.is_free, a.completed_at, a.created_at, a.updated_at,
  c.id as c_id, c.user_id as c_user_id, c.name as c_name, c.color as c_color, c.points_per_hour as c_points_per_hour
`;

function mapActivityRow(row: Record<string, unknown>) {
  const category = row.c_id != null
    ? { id: row.c_id, userId: row.c_user_id, name: row.c_name, color: row.c_color, pointsPerHour: row.c_points_per_hour }
    : null;
  return mapRow({
    ...row,
    category,
  });
}

export async function findActivitiesByUser(userId: string) {
  const rows = await queryMany(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a LEFT JOIN categories c ON c.id = a.category_id
     WHERE a.user_id = $1 ORDER BY a.date ASC, a.start_at ASC`,
    [userId]
  );
  return rows.map(mapActivityRow);
}

export async function findActivitiesByUserRange(userId: string, from?: Date | null, to?: Date | null) {
  const conditions: string[] = ["a.user_id = $1"];
  const params: any[] = [userId];
  if (from) {
    params.push(from);
    conditions.push(`a.start_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`a.start_at <= $${params.length}`);
  }
  const rows = await queryMany(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a LEFT JOIN categories c ON c.id = a.category_id
     WHERE ${conditions.join(" AND ")} ORDER BY a.start_at ASC`,
    params
  );
  return rows.map(mapActivityRow);
}

export async function findRecentActivities(userId: string, from: Date, to: Date, limit: number) {
  const rows = await queryMany(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a LEFT JOIN categories c ON c.id = a.category_id
     WHERE a.user_id = $1 AND a.start_at >= $2 AND a.start_at <= $3
     ORDER BY a.start_at DESC LIMIT $4`,
    [userId, from, to, limit]
  );
  return rows.map(mapActivityRow);
}

export async function findActivityByIdAndUser(id: string, userId: string) {
  const row = await queryOne(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a LEFT JOIN categories c ON c.id = a.category_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId]
  );
  return row ? mapActivityRow(row) : null;
}

export async function findPlannedActivitiesAfter(userId: string, after: Date) {
  const rows = await queryMany(
    `SELECT id, date, start_at, end_at FROM activities
     WHERE user_id = $1 AND status = 'PLANNED' AND start_at >= $2`,
    [userId, after]
  );
  return rows.map(mapRow);
}

export async function createActivity(data: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const mapped = val(v);
    if (mapped !== undefined) clean[camelToSnake(k)] = mapped;
  }
  const cols = Object.keys(clean);
  const params = Object.values(clean);
  const row = await queryOne(
    `INSERT INTO activities (${cols.join(", ")})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id, user_id, category_id, title, description, date, start_at, end_at, status, points, is_free, completed_at, created_at, updated_at`,
    params
  );
  if (!row) return null;
  const joined = {
    ...row,
    c_id: null,
    c_user_id: null,
    c_name: null,
    c_color: null,
    c_points_per_hour: null,
  };
  return mapActivityRow(joined);
}

export async function updateActivity(id: string, userId: string, data: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const mapped = val(v);
    if (mapped !== undefined) clean[k] = mapped;
  }
  clean.updated_at = new Date();
  const { sets, params } = buildUpdate(clean);
  if (sets.length === 0) return findActivityByIdAndUser(id, userId);
  await query(
    `UPDATE activities SET ${sets.join(", ")} WHERE id = $${params.length + 1} AND user_id = $${params.length + 2}`,
    [...params, id, userId]
  );
  return findActivityByIdAndUser(id, userId);
}

export async function updateActivityTimes(id: string, date: Date, startAt: Date, endAt: Date) {
  await query(
    `UPDATE activities SET date = $1, start_at = $2, end_at = $3, updated_at = now() WHERE id = $4`,
    [date, startAt, endAt, id]
  );
}

export async function deleteActivityByIdAndUser(id: string, userId: string) {
  const result = await query(
    `DELETE FROM activities WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rowCount ?? 0;
}

/* ---------------------------------------------------------------- */
/* Rewards                                                          */
/* ---------------------------------------------------------------- */

const REWARD_COLUMNS = `id, user_id, title, cost, description, redeemed_at`;

export async function findRewardsByUser(userId: string) {
  const rows = await queryMany(
    `SELECT ${REWARD_COLUMNS} FROM rewards WHERE user_id = $1 ORDER BY cost ASC`,
    [userId]
  );
  return mapRows(rows);
}

export async function createReward(data: { userId: string; title: string; cost: number; description?: string | null }) {
  const row = await queryOne(
    `INSERT INTO rewards (user_id, title, cost, description) VALUES ($1, $2, $3, $4) RETURNING ${REWARD_COLUMNS}`,
    [data.userId, data.title, data.cost, data.description ?? null]
  );
  return row ? mapRow(row) : null;
}

/* ---------------------------------------------------------------- */
/* Suggestions                                                      */
/* ---------------------------------------------------------------- */

const SUGGESTION_COLUMNS = `id, user_id, generation_id, title, category, duration, reason, points, suggested_time, source, created_at`;

export async function createManySuggestions(values: Array<{
  userId: string;
  generationId: string;
  title: string;
  category: string;
  duration: number;
  reason: string;
  points: number;
  suggestedTime: string | null;
  source: string;
}>) {
  for (const value of values) {
    await query(
      `INSERT INTO suggestions (user_id, generation_id, title, category, duration, reason, points, suggested_time, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [value.userId, value.generationId, value.title, value.category, value.duration, value.reason, value.points, value.suggestedTime, value.source]
    );
  }
}

export async function findSuggestionsByGeneration(userId: string, generationId: string) {
  const rows = await queryMany(
    `SELECT ${SUGGESTION_COLUMNS} FROM suggestions WHERE user_id = $1 AND generation_id = $2 ORDER BY created_at ASC`,
    [userId, generationId]
  );
  return mapRows(rows);
}

export async function findRecentSuggestions(userId: string, limit = 5) {
  const rows = await queryMany(
    `SELECT ${SUGGESTION_COLUMNS} FROM suggestions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return mapRows(rows);
}

/* ---------------------------------------------------------------- */
/* QR tokens                                                        */
/* ---------------------------------------------------------------- */

const QR_COLUMNS = `id, user_id, token_hash, expires_at, used_at, created_at`;

export async function deleteUnusedQrTokens(userId: string) {
  await query(`DELETE FROM qr_login_tokens WHERE user_id = $1 AND used_at IS NULL`, [userId]);
}

export async function createQrToken(userId: string, tokenHash: string, expiresAt: Date) {
  const row = await queryOne(
    `INSERT INTO qr_login_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING ${QR_COLUMNS}`,
    [userId, tokenHash, expiresAt]
  );
  return row ? mapRow(row) : null;
}

export async function findQrTokenByHash(tokenHash: string) {
  const row = await queryOne(`SELECT ${QR_COLUMNS} FROM qr_login_tokens WHERE token_hash = $1`, [tokenHash]);
  return row ? mapRow(row) : null;
}

export async function consumeQrToken(id: string) {
  const result = await query(
    `UPDATE qr_login_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL AND expires_at > now()`,
    [id]
  );
  return result.rowCount ?? 0;
}