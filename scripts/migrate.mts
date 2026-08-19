/**
 * Applies pending migrations.
 *
 *   npm run db:migrate
 *
 * This exists instead of calling `drizzle-kit migrate` directly, and the
 * reason is worth knowing.
 *
 * drizzle-kit picks a driver by looking at what is installed. With
 * @neondatabase/serverless present and no `pg`, it chooses the serverless
 * driver and tries to reach Postgres over a WebSocket, which needs the `ws`
 * package in Node. Without it the command does not fail: it prints
 * "applying migrations..." and hangs there indefinitely, which is a far worse
 * way to lose ten minutes than an error would have been.
 *
 * Using the HTTP migrator instead means migrations travel exactly the same
 * path as every query the running app makes. One driver, one failure mode,
 * nothing extra to install.
 */

import { loadEnv } from "./load-env.mts";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  loadEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const started = Date.now();
  await migrate(drizzle(neon(url)), { migrationsFolder: "./lib/db/migrations" });
  console.log(`Migrations applied in ${Date.now() - started}ms.`);
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
