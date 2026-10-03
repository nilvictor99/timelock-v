import { readdirSync } from "fs";
import { join } from "path";
import { query, queryOne } from "./db.js";

const SEEDERS_DIR = join(process.cwd(), "database", "seeders");

function getSeederFiles(): string[] {
  return readdirSync(SEEDERS_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();
}

export async function runSeeders() {
  const files = getSeederFiles();
  if (files.length === 0) {
    console.log("No seeders found.");
    return;
  }

  await ensureSeedersTable();

  for (const file of files) {
    const existing = await queryOne<{ name: string }>("SELECT name FROM _seeders WHERE name = $1", [file]);
    if (existing) {
      console.log(`  ⏭  ${file} (already run)`);
      continue;
    }

    const seederUrl = new URL(`file://${join(SEEDERS_DIR, file)}`);
    try {
      const mod = await import(seederUrl.href);
      const fn = typeof mod.default === "function"
        ? mod.default
        : typeof mod.up === "function"
          ? mod.up
          : null;
      if (fn) {
        await fn();
        await query("INSERT INTO _seeders (name) VALUES ($1)", [file]);
        console.log(`  ✓ ${file}`);
      } else {
        console.log(`  ⚠ ${file} - no default/up export, skipping`);
      }
    } catch (err) {
      console.error(`  ✗ ${file}:`, err);
      throw err;
    }
  }
  console.log("Seeds done.");
}

async function ensureSeedersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _seeders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}