/**
 * Move a trip through its lifecycle.
 *
 * One route for share, unshare, archive and unarchive, because they are the
 * same operation with different arguments, and four routes that each did their
 * own state check is exactly how the checks drift apart.
 */

import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { getTrip, transitionTrip } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";
import { isTripState, refusalReason, type TripState } from "@/lib/trip-state";

type Params = { params: Promise<{ id: string }> };

/** What each action means as a move. */
const ACTIONS: Record<string, { to: TripState; verb: string }> = {
  share: { to: "shared", verb: "share" },
  unshare: { to: "ready", verb: "unshare" },
  archive: { to: "archived", verb: "archive" },
  unarchive: { to: "ready", verb: "unarchive" },
};

export async function POST(request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = ACTIONS[String(body.action ?? "")];
    if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });

    const trip = await getTrip(id, viewer.userId);
    if (!trip) return Response.json({ error: "No such trip." }, { status: 404 });

    const from = isTripState(trip.state) ? trip.state : "draft";

    const moved = await transitionTrip({
      tripId: id,
      userId: viewer.userId,
      from,
      to: action.to,
      extra: action.to === "shared" ? { sharedAt: new Date() } : undefined,
    });

    if (!moved) {
      // 409, not 400. The request was well formed; the trip is just not in a
      // state where this makes sense, and the message says which.
      return Response.json(
        { error: refusalReason(from, action.verb), state: from },
        { status: 409 },
      );
    }

    logInfo("trip.transition", {
      userId: viewer.userId,
      tripId: id,
      from,
      to: action.to,
    });

    return Response.json({ state: moved.state });
  } catch (error) {
    logError("trip.transition_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "We could not do that." }, { status: 500 });
  }
}
