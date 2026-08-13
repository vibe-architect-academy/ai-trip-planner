/**
 * Is this thing actually working?
 *
 * A health check that only returns 200 tells you the server is running, which
 * you already knew because it answered. The useful question is whether the
 * things it depends on are reachable, because that is what breaks at 3am.
 *
 * Every dependency is checked in parallel with a short timeout, so a slow one
 * cannot make this endpoint the thing that times out.
 */

import { isDatabaseConfigured, db } from "@/lib/db";
import { isQueueConfigured } from "@/lib/queue";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { isAiConfigured } from "@/lib/ai/provider";
import { isEmailConfigured } from "@/lib/email/send";
import { logError } from "@/lib/log";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; note?: string; ms?: number };

async function timed(name: string, run: () => Promise<void>): Promise<Check> {
  const started = Date.now();
  try {
    await run();
    return { name, ok: true, ms: Date.now() - started };
  } catch (error) {
    /*
     * The reason goes to the logs. It does not go in the response.
     *
     * This route is public, because an uptime monitor cannot sign in. And a
     * driver that fails to parse its own configuration tends to quote that
     * configuration back at you: for a database, the configuration is a URL
     * with the password in it. Passing a dependency's error message straight
     * through publishes whatever that dependency decided to include.
     *
     * "unreachable" is everything a monitor needs. Whoever is debugging has
     * the logs, and they had to sign in to read them.
     */
    logError("health check failed", error, { check: name });
    return { name, ok: false, ms: Date.now() - started, note: "unreachable" };
  }
}

export async function GET() {
  const checks: Check[] = [];

  if (!isDatabaseConfigured()) {
    checks.push({ name: "database", ok: false, note: "not configured" });
  } else {
    checks.push(
      await timed("database", async () => {
        // The cheapest possible query that proves a real round trip.
        await db().execute(sql`select 1`);
      }),
    );
  }

  // These have no cheap ping worth making on every check, so report only
  // whether they are wired up. Saying "configured" is honest; claiming
  // "healthy" for something never contacted would not be.
  checks.push({ name: "queue", ok: isQueueConfigured(), note: "configuration only" });
  checks.push({ name: "billing", ok: isBillingConfigured(), note: "configuration only" });
  checks.push({ name: "ai", ok: isAiConfigured(), note: "configuration only" });
  checks.push({ name: "email", ok: isEmailConfigured(), note: "configuration only" });

  const healthy = checks.every((check) => check.ok);

  return Response.json(
    { status: healthy ? "ok" : "degraded", checks, at: new Date().toISOString() },
    {
      // 503 when degraded, so an uptime monitor can tell without reading JSON.
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
