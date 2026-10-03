try {
  process.loadEnvFile(".env");
} catch {
  // .env opcional; en entornos tipo Docker las variables ya vienen del entorno.
}

async function main() {
  const [{ migrate, migrateRollback, migrateStatus, migrateFresh }, { runSeeders }, { closePool, query }] =
    await Promise.all([
      import("../src/lib/migration-runner.js"),
      import("../src/lib/seeder-runner.js"),
      import("../src/lib/db.js"),
    ]);

  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "migrate":
      await migrate();
      break;
    case "migrate:fresh":
    case "db:refresh":
      await migrateFresh();
      await runSeeders();
      break;
    case "migrate:rollback":
      await migrateRollback(arg ? Number(arg) : 1);
      break;
    case "migrate:status":
      await migrateStatus();
      break;
    case "seed":
    case "db:seed":
      await runSeeders();
      break;
    case "db:check":
      await query("SELECT 1");
      console.log("OK");
      break;
    default:
      console.log(`
Usage:
  npm run db:migrate            Run pending migrations
  npm run db:rollback [steps]   Rollback last migration batch
  npm run db:status             Show migration status
  npm run db:seed               Run seeders
  npm run db:refresh            Drop all tables and re-migrate + seed
      `);
  }
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});