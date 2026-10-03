try {
  process.loadEnvFile(".env");
} catch {
  // .env opcional; en Docker las variables ya vienen del entorno.
}

import { readdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { performance } from "perf_hooks";

const hasColor = process.stdout.isTTY && !process.env.NO_COLOR;
const reset = "\x1b[0m";
const paint = (code: string) => (s: string) => (hasColor ? `\x1b[${code}m${s}${reset}` : s);
const green = paint("32");
const red = paint("31");
const yellow = paint("33");
const cyan = paint("36");
const dim = paint("2");
const bold = paint("1");

type Flags = { seed: boolean; yes: boolean; steps: number | null };

function parseArgs(args: string[]): { command: string; flags: Flags; positional: string[] } {
  const flags: Flags = { seed: false, yes: false, steps: null };
  const positional: string[] = [];
  let command = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--seed" || a === "-s") flags.seed = true;
    else if (a === "--yes" || a === "-y") flags.yes = true;
    else if (a === "--steps" || a === "-n") {
      const n = Number(args[i + 1]);
      if (Number.isFinite(n)) {
        flags.steps = Math.max(1, Math.floor(n));
        i++;
      }
    } else if (a.startsWith("--steps=")) {
      const n = Number(a.slice("--steps=".length));
      if (Number.isFinite(n)) flags.steps = Math.max(1, Math.floor(n));
    } else if (a.startsWith("-")) {
      // flag desconocido: se ignora
    } else if (!command) command = a;
    else positional.push(a);
  }
  return { command, flags, positional };
}

async function runWithSpinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const captured: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => captured.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => captured.push(a.map(String).join(" "));

  let spinnerId: ReturnType<typeof setInterval> | undefined;
  if (hasColor) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    spinnerId = setInterval(() => {
      process.stdout.write(`\r${cyan(frames[i++ % frames.length])} ${label}…`);
    }, 80);
  }

  const start = performance.now();
  try {
    const result = await fn();
    if (spinnerId) clearInterval(spinnerId);
    process.stdout.write("\r\x1b[K");
    console.log = origLog;
    console.error = origErr;
    captured.forEach((l) => origLog(dim(`  ${l}`)));
    origLog(`  ${green("✓")} ${label} · ${((performance.now() - start) / 1000).toFixed(2)}s`);
    return result;
  } catch (err) {
    if (spinnerId) clearInterval(spinnerId);
    process.stdout.write("\r\x1b[K");
    console.log = origLog;
    console.error = origErr;
    captured.forEach((l) => origLog(dim(`  ${l}`)));
    throw err;
  }
}

async function confirmYes(msg: string): Promise<boolean> {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${yellow(msg)} ${dim("[y/N]")} `, (ans) => {
      rl.close();
      const a = ans.trim().toLowerCase();
      resolve(a === "y" || a === "yes");
    });
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nextSequence(dir: string): string {
  const files = existsSync(dir) ? readdirSync(dir) : [];
  let max = 0;
  for (const f of files) {
    const m = /^(\d+)_/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1).padStart(5, "0");
}

function printTable(headers: string[], rows: (string | number)[][]) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const line = (cells: (string | number)[]) =>
    "  " + cells.map((c, i) => c.toString().padEnd(widths[i])).join("  ");
  console.log(dim("  " + headers.map((h, i) => "─".repeat(widths[i])).join("──")));
  console.log(bold(line(headers)));
  console.log(dim("  " + headers.map((h, i) => "─".repeat(widths[i])).join("──")));
  rows.forEach((r) => console.log(line(r)));
}

const HELP = `
${bold("TimeLock-v · tl")} — CLI de base de datos

${cyan("migraciones y datos")}
  tl migrate [--seed]             aplicar migraciones pendientes
  tl status                       estado de migraciones en tabla
  tl rollback [N] [--steps N]     revertir el último lote (N lotes default 1)
  tl fresh [--seed]               borrar todo y re-migrar (pide confirmación)
  tl seed                         ejecutar seeders pendientes
  tl check                        diagnosticar conexión PostgreSQL

${cyan("generadores")}
  tl make:migration <nombre>      crear migración 00NNN_nombre.sql (UP/DOWN)
  tl make:seeder <nombre>         crear seeder 00NNN_nombre.ts

${cyan("aliases")}
  tl m ≡ migrate · tl st ≡ status · tl rb ≡ rollback · tl f ≡ fresh

${cyan("flags")}
  -s, --seed    sembrar datos al terminar   -y, --yes   saltar confirmación
  -n, --steps N nº de lotes a revertir      -h, --help  ayuda
`;

async function main() {
  const { ensureMigrationsTable, migrate, migrateRollback, migrateFresh } = await import(
    "../src/lib/migration-runner.js"
  );
  const { runSeeders } = await import("../src/lib/seeder-runner.js");
  const { closePool, queryMany } = await import("../src/lib/db.js");

  const MIGRATIONS_DIR = join(process.cwd(), "database", "migrations");
  const SEEDERS_DIR = join(process.cwd(), "database", "seeders");

  async function runStatus() {
    await ensureMigrationsTable();
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const rows = await queryMany<{ name: string; batch: number; executed_at: Date }>(
      "SELECT name, batch, executed_at FROM _migrations ORDER BY id"
    );
    const applied = new Map(rows.map((r) => [r.name, r]));

    if (files.length === 0) {
      console.log(yellow("  No hay migraciones en database/migrations/."));
      return;
    }

    const table = files.map((f) => {
      const r = applied.get(f);
      return r
        ? [green("✓"), f, `lote ${r.batch}`, r.executed_at.toISOString().replace("T", " ").slice(0, 19)]
        : [dim("○"), f, "—", "pendiente"];
    });

    printTable(["", "Migración", "Lote", "Aplicada"], table);

    const pending = files.length - applied.size;
    console.log();
    console.log(
      pending === 0
        ? green(`  ${applied.size} migraciones aplicadas. Todo al día.`)
        : yellow(`  ${pending} pendiente(s) de ${files.length}. Ejecuta: tl migrate --seed`)
    );
  }

  async function makeMigration(name: string) {
    if (!name) throw new Error("Uso: tl make:migration <nombre> (ej. tl make:migration crear modulo notas)");
    const slug = slugify(name);
    const seq = nextSequence(MIGRATIONS_DIR);
    const file = `${seq}_${slug}.sql`;
    const title = name.trim().replace(/[_-\s]+/g, " ");
    const body =
      `-- TimeLock-v: ${title}\n` +
      `-- Generada con 'tl make:migration'. Define el cambio y su inverso.\n\n` +
      `-- UP\n` +
      `-- Escribe aqui tu SQL (ej: ALTER TABLE ... ADD COLUMN ...)\n\n` +
      `\n-- DOWN\n-- Invierte lo hecho en UP, por ejemplo: ALTER TABLE ... DROP COLUMN ...\n`;
    writeFileSync(join(MIGRATIONS_DIR, file), body);
    console.log(green(`  ✓ Creada ${cyan(file)}`));
    console.log(dim(`  ${join(MIGRATIONS_DIR, file)}`));
    console.log(`  Siguiente: ${cyan(`tl migrate`)}`);
  }

  async function makeSeeder(name: string) {
    if (!name) throw new Error("Uso: tl make:seeder <nombre> (ej. tl make:seeder categorias iniciales)");
    const slug = slugify(name);
    const seq = nextSequence(SEEDERS_DIR);
    const file = `${seq}_${slug}.ts`;
    const title = name.trim().replace(/[_-\s]+/g, " ");
    const body =
      `/**\n` +
      ` * TimeLock-v: seeder '${title}'.\n` +
      ` * Exporta una funcion default (o 'up') con la carga de datos iniciales.\n` +
      ` */\nexport default async function () {\n  // TODO: escribir la carga de datos aqui.\n  console.log("Seed: ${slug} (pendiente de implementar).");\n}\n`;
    writeFileSync(join(SEEDERS_DIR, file), body);
    console.log(green(`  ✓ Creada ${cyan(file)}`));
    console.log(dim(`  ${join(SEEDERS_DIR, file)}`));
    console.log(`  Siguiente: ${cyan(`tl seed`)}`);
  }

  async function runCheck() {
    const rows = await queryMany<{ version: string }>("SELECT version()");
    console.log(green("  OK · PostgreSQL responde."));
    console.log(dim(`  ${rows[0]?.version ?? ""}`));
    const url = process.env.DATABASE_URL ?? "";
    const safe = url.replace(/:[^:@]*@/, ":***@");
    console.log(dim(`  ${safe}`));
  }

  const { command, flags, positional } = parseArgs(process.argv.slice(2));
  const steps =
    flags.steps ?? (positional[0] && Number.isFinite(Number(positional[0])) ? Number(positional[0]) : 1);
  const wantSeed = flags.seed;

  switch (command) {
    case "":
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;

    case "migrate":
    case "m": {
      await runWithSpinner("Aplicando migraciones", migrate);
      if (wantSeed) {
        console.log();
        await runWithSpinner("Sembrando datos", runSeeders);
      }
      break;
    }

    case "status":
    case "st":
      await runStatus();
      break;

    case "rollback":
    case "rb":
      await runWithSpinner(`Revirtiendo ${steps} lote(s)`, () => migrateRollback(steps));
      break;

    case "fresh":
    case "f": {
      const ok = await confirmYes("Borrar TODAS las tablas y re-migrar. ¿Seguro?");
      if (!ok) {
        console.log(dim("Cancelado."));
        break;
      }
      await runWithSpinner("Reconstruyendo base de datos", migrateFresh);
      if (wantSeed) {
        console.log();
        await runWithSpinner("Sembrando datos", runSeeders);
      }
      break;
    }

    case "seed":
      await runWithSpinner("Sembrando datos", runSeeders);
      break;

    case "check":
      await runCheck();
      break;

    case "make:migration":
      await makeMigration(positional[0] ?? "");
      break;

    case "make:seeder":
      await makeSeeder(positional[0] ?? "");
      break;

    default:
      console.error(`${red("tl:")} comando desconocido '${command}'. Ejecuta 'tl help'.`);
      process.exitCode = 1;
  }

  await closePool();
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${red("tl:")} ${msg}`);
  process.exitCode = 1;
});