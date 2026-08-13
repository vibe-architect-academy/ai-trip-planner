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

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Loads .env.local without a dependency.
 *
 * Next does this for you at runtime, but a standalone script gets nothing, so
 * without this the script reads an undefined DATABASE_URL and reports a
 * missing database on a machine where the database is configured perfectly.
 */
function loadEnv(file = ".env.local") {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // Strip surrounding quotes, which Neon includes and which are not part
    // of the value.
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");

    // A real environment variable always wins over the file, so CI and the
    // hosting platform stay in charge.
    if (!process.env[key]) process.env[key] = value;
  }
}

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
