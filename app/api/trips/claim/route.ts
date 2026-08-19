/**
 * Turn a preview into a trip that belongs to someone.
 *
 * This is the moment the whole landing page is arranged around. Somebody
 * watched an itinerary get written, decided they wanted to keep it, and signed
 * in. What they keep has to be the itinerary they watched.
 *
 * So this copies the stored preview rather than asking the model again.
 * Regenerating would be easier and would quietly hand them a different trip
 * from the one they just read, which is a strange thing to do to somebody who
 * has just given you their email address.
 *
 * The itinerary comes out of our own database, never off the request. A route
 * that accepted the text from the browser would let anyone write anything into
 * a trip and call it generated.
 */

import { logError } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { getAllowance } from "@/lib/db/billing";
import { limitMessage } from "@/lib/billing/plans";
import { track, EVENTS } from "@/lib/analytics";
import { createTrip, saveItinerary, markTripReady } from "@/lib/db/trips";
import { getLivePreview, deletePreview } from "@/lib/db/previews";
import { isDatabaseConfigured } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) return unauthorized();
    if (viewer.banned) return forbidden("This account has been suspended.");
    if (!isDatabaseConfigured()) {
      return Response.json({ error: "The database is not configured." }, { status: 500 });
    }

    let body: { previewId?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "That request did not make sense." }, { status: 400 });
    }

    const previewId = String(body.previewId ?? "").trim();
    if (!previewId) {
      return Response.json({ error: "There is nothing to save." }, { status: 400 });
    }

    const preview = await getLivePreview(previewId);
    /*
     * 404 for expired and 404 for never-existed, on purpose. Telling the
     * difference would let somebody walk the id space and learn which previews
     * are real, and the honest answer to both is the same: there is nothing
     * here to save.
     */
    if (!preview || !preview.rawItinerary?.trim()) {
      return Response.json(
        { error: "That trip has expired. Plan it again and it is yours." },
        { status: 404 },
      );
    }

    // Saving one costs a trip from their allowance, because it becomes a trip.
    const allowance = await getAllowance(viewer.userId);
    if (!allowance.canCreate) {
      track(viewer.userId, EVENTS.limitHit, { reason: "trips", used: allowance.used });
      return Response.json(
        { error: limitMessage("trips"), plan: allowance.plan, upgrade: true },
        { status: 402 },
      );
    }

    const trip = await createTrip({
      userId: viewer.userId,
      destination: preview.destination,
      dayCount: preview.dayCount,
    });

    await saveItinerary({
      tripId: trip.id,
      userId: viewer.userId,
      rawItinerary: preview.rawItinerary,
    });
    await markTripReady(trip.id);

    /*
     * Deleted only after the trip is safely written. The other order loses the
     * itinerary entirely if the insert fails, and a preview that lingers for a
     * day costs nothing.
     */
    await deletePreview(previewId).catch((error) =>
      logError("claim.preview_delete_failed", error, { previewId }),
    );

    track(viewer.userId, EVENTS.previewClaimed, {
      tripId: trip.id,
      days: preview.dayCount,
    });

    return Response.json({ tripId: trip.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("claim.unhandled", error);
    return Response.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
