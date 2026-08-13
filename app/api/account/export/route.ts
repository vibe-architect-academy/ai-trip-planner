/**
 * "Give me everything you hold about me."
 *
 * A legal right in the EU and several other places, and a reasonable request
 * anywhere. It has to be everything this app stores, in a form a person can
 * actually open, which is why it is JSON rather than a link to a dashboard.
 */

import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { listTrips, getTrip } from "@/lib/db/trips";
import { listPhotos } from "@/lib/db/photos";
import { getPlan } from "@/lib/db/billing";
import { isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  try {
    const trips = await listTrips(viewer.userId);

    const full = await Promise.all(
      trips.map(async (trip) => ({
        ...trip,
        days: (await getTrip(trip.id, viewer.userId))?.days ?? [],
        photos: await listPhotos(trip.id, viewer.userId),
      })),
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        userId: viewer.userId,
        plan: await getPlan(viewer.userId),
        // Name and email are not here because this app never stores them.
        // Clerk holds them, and their own export covers that. Saying so is
        // more useful than silently returning less than someone expected.
        note: "Your name and email are held by Clerk, our sign-in provider, not by this app.",
      },
      trips: full,
    };

    logInfo("account.exported", { userId: viewer.userId, trips: trips.length });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Downloads as a file rather than opening as a wall of text.
        "Content-Disposition": `attachment; filename="trip-planner-export.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logError("account.export_failed", error, { userId: viewer.userId });
    return Response.json({ error: "We could not build your export." }, { status: 500 });
  }
}
