import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The database connection.
 *
 * Built lazily, on first use, rather than when this module is imported. That
 * is deliberate: `next build` imports every module to work out what the routes
 * are, and a connection created at import time would mean the build fails on
 * any machine without a DATABASE_URL. A missing credential should stop a
 * request, not a build.
 */

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  cached = drizzle(neon(url), { schema });
  return cached;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
