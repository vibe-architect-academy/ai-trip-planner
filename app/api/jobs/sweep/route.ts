/**
 * Takes the bins out, once a night.
 *
 * Two tables here hold rows that are worthless the moment they expire:
 * previews nobody claimed, and rate-limit counters for windows that have
 * closed. Expiry is not deletion. A `previews` table full of technically
 * expired rows is still a table full of strangers' itineraries, and the only
 * honest answer to "how long do you keep this" is the one your DELETE
 * statement gives.
 *
 * On a schedule rather than opportunistically, because the opportunistic
 * sweep only runs when somebody creates a preview. A quiet week is exactly
 * when nothing gets cleaned up and exactly when you would like it to be.
 *
 * Public in the router and guarded by QStash's signature, same as the other
 * workers. A cleanup endpoint anyone can call is a small denial-of-service
 * button with a friendly name.
 */

import { logError, logInfo } from "@/lib/log";
import { isFromQueue } from "@/lib/queue";
import { isDatabaseConfigured } from "@/lib/db";
import { deleteExpiredPreviews } from "@/lib/db/previews";
import { deleteExpiredCounters } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  /*
   * The raw body, read once, before anything else looks at it.
   *
   * The signature covers the exact bytes QStash sent. Parsing to JSON and
   * re-serialising produces a different string and a signature that never
   * verifies, and the bug reads as "QStash is sending bad signatures".
   */
  const body = await request.text();

  if (!(await isFromQueue(request, body))) {
    return Response.json({ error: "Not from the queue." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  try {
    const [previews, counters] = await Promise.all([
      deleteExpiredPreviews(),
      deleteExpiredCounters(),
    ]);

    logInfo("sweep.done", { previews, counters });
    return Response.json({ previews, counters });
  } catch (error) {
    /*
     * 500 rather than a quiet 200. QStash retries a failed job, and a sweep
     * that silently reports success is a sweep you find out about when the
     * table is a year old.
     */
    logError("sweep.failed", error);
    return Response.json({ error: "The sweep failed." }, { status: 500 });
  }
}
