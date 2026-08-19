import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";

/**
 * How often one caller may do an expensive thing.
 *
 * This exists because of one route: an anonymous visitor can generate an
 * itinerary, and generating an itinerary costs money. There is no account to
 * suspend and no card to charge, so the only thing standing between the demo
 * and a free AI proxy is a counter.
 *
 * Fixed window rather than a sliding one. A sliding window is fairer and needs
 * a sorted set per subject; a fixed window needs one integer and is honest
 * about its one flaw, which is that a caller can spend two windows' worth
 * across a boundary. For "stop somebody scripting this" that is fine.
 */

const WINDOW_CLEANUP_ODDS = 0.02;

/**
 * Who is asking, in a form that is safe to store.
 *
 * An IP address is personal data, and this table would otherwise be a log of
 * everyone who ever opened the page. Hashing it keeps the counter working,
 * because the same caller hashes the same way, while leaving nothing in the
 * database worth stealing or worth a subject access request.
 *
 * Salted so the hashes cannot be reversed with a list of every IPv4 address,
 * which is a small enough list to be worth someone's afternoon.
 */
export function subjectFromRequest(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  // x-forwarded-for is a list; the client is the first entry.
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? "trip-planner";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export type Verdict = {
  ok: boolean;
  /** How many of this window's allowance are left after this call. */
  remaining: number;
  /** Seconds until the window resets, for a Retry-After header. */
  resetIn: number;
};

/**
 * Count one use and say whether it was allowed.
 *
 * The increment and the check are a single statement on purpose. Read-then-
 * write across two round trips is a race, and the thing it races with is
 * exactly the script you are trying to stop: twenty parallel requests all read
 * "count is 0" and all decide they are fine.
 */
export async function consume(
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<Verdict> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetIn = windowStart + windowSeconds - now;
  const key = `${bucket}:${subject}:${windowStart}`;
  const expiresAt = new Date((windowStart + windowSeconds) * 1000);

  try {
    const rows = await db().execute<{ count: number }>(sql`
      insert into rate_limits (key, count, expires_at)
      values (${key}, 1, ${expiresAt})
      on conflict (key) do update set count = rate_limits.count + 1
      returning count
    `);

    const used = Number(rows.rows?.[0]?.count ?? 1);

    if (Math.random() < WINDOW_CLEANUP_ODDS) {
      // Nobody is paying for a cron to delete integers. Sweep occasionally,
      // on somebody else's request, and never let it break that request.
      db()
        .execute(sql`delete from rate_limits where expires_at < now()`)
        .catch(() => null);
    }

    return { ok: used <= limit, remaining: Math.max(0, limit - used), resetIn };
  } catch (error) {
    /*
     * Fail open, and this is a real decision rather than an oversight.
     *
     * A limiter that fails closed turns one broken database into a site that
     * refuses everybody. What this protects is a budget, not a secret: the
     * worst case of failing open is a bill, and the worst case of failing
     * closed is an outage. For a paywall or a login the answer would be the
     * other way around.
     */
    logError("rate_limit.unavailable", error, { bucket });
    return { ok: true, remaining: 0, resetIn };
  }
}

/** Housekeeping, for the nightly sweep. Returns how many counters were removed. */
export async function deleteExpiredCounters(): Promise<number> {
  const result = await db().execute(sql`delete from rate_limits where expires_at < now()`);
  return Number(result.rowCount ?? 0);
}

export function tooManyRequests(message: string, resetIn: number): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, resetIn)) } },
  );
}
