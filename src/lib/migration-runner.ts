import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { pool, query, queryOne, queryMany } from "./db.js";

const MIGRATIONS_DIR = join(process.cwd(), "database", "migrations");

export async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      batch INTEGER NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function getExecutedMigrations(): Promise<string[]> {
  const rows = await queryMany<{ name: string }>("SELECT name FROM _migrations ORDER BY id");
  return rows.map((r) => r.name);
}

const DOWN_MARKER = /\n-- DOWN(?:\n|$)/;

function splitUpDown(content: string): { up: string; down: string } {
  const m = DOWN_MARKER.exec(content);
  if (!m) return { up: content, down: "" };
  const nextLineStart = m.index + m[0].length;
  return { up: content.slice(0, m.index), down: content.slice(nextLineStart).trim() };
}

async function runMigration(filePath: string, name: string, batch: number) {
  const content = readFileSync(filePath, "utf8");
  const { up } = splitUpDown(content);
  if (!up.trim()) {
    console.log(`  ⚠ ${name} - empty UP section, skipping`);
    return;
  }
  await pool.query(up);
  await query("INSERT INTO _migrations (name, batch) VALUES ($1, $2)", [name, batch]);
  console.log(`  ✓ ${name}`);
}

async function rollbackMigration(name: string) {
  const filePath = join(MIGRATIONS_DIR, name);
  const content = readFileSync(filePath, "utf8");
  const { down } = splitUpDown(content);

  if (!down) {
    console.log(`  ⚠ ${name} - no DOWN section, skipping`);
    return;
  }

  await pool.query(down);
  await query("DELETE FROM _migrations WHERE name = $1", [name]);
  console.log(`  ↓ ${name}`);
}

export async function migrate() {
  await ensureMigrationsTable();
  const files = getMigrationFiles();
  const executed = await getExecutedMigrations();
  const executedSet = new Set(executed);
  const pending = files.filter((f) => !executedSet.has(f));

  if (pending.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  const lastBatch = await queryOne<{ batch: number }>("SELECT COALESCE(MAX(batch), 0) as batch FROM _migrations");
  const batch = (lastBatch?.batch ?? 0) + 1;

  console.log(`Running ${pending.length} migration(s)...`);
  for (const file of pending) {
    await runMigration(join(MIGRATIONS_DIR, file), file, batch);
  }
  console.log("Done.");
}

export async function migrateRollback(steps = 1) {
  await ensureMigrationsTable();
  const lastBatch = await queryOne<{ batch: number }>("SELECT MAX(batch) as batch FROM _migrations");
  if (!lastBatch?.batch) {
    console.log("Nothing to rollback.");
    return;
  }

  const toRollback = await queryMany<{ name: string }>(
    "SELECT name FROM _migrations WHERE batch = $1 ORDER BY id DESC LIMIT $2",
    [lastBatch.batch, steps]
  );

  if (toRollback.length === 0) {
    console.log("Nothing to rollback.");
    return;
  }

  console.log(`Rolling back ${toRollback.length} migration(s)...`);
  for (const row of toRollback) {
    await rollbackMigration(row.name);
  }
  console.log("Done.");
}

export async function migrateStatus() {
  await ensureMigrationsTable();
  const files = getMigrationFiles();
  const executed = await getExecutedMigrations();
  const executedSet = new Set(executed);

  console.log("Migration status:");
  for (const file of files) {
    const mark = executedSet.has(file) ? "✓" : "○";
    console.log(`  ${mark} ${file}`);
  }
}

/** Drops every app table and re-runs all migrations (local dev only). */
export async function migrateFresh() {
  await ensureMigrationsTable();
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type
                JOIN pg_namespace n ON n.oid = pg_type.typnamespace
                WHERE n.nspname = 'public' AND pg_type.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log("Fresh: all public schemas dropped.");
  await migrate();
}