/**
 * One trip.
 *
 * The whole "user A cannot read user B's trip" claim lives here, and it is one
 * line: the viewer's id goes into the query. There is no branch that could be
 * forgotten, because there is no version of this query that ignores ownership.
 */

import { logError } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { getTrip, deleteTrip } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  const { id } = await params;

  try {
    const trip = await getTrip(id, viewer.userId);

    // 404, not 403, and on purpose. "That is not yours" confirms the trip
    // exists, which is already more than a stranger should learn.
    if (!trip) return Response.json({ error: "No such trip." }, { status: 404 });

    return Response.json({ trip });
  } catch (error) {
    logError("trip.read_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "We could not load that trip." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  const { id } = await params;

  try {
    const removed = await deleteTrip(id, viewer.userId);
    if (!removed) return Response.json({ error: "No such trip." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    logError("trip.delete_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "We could not delete that trip." }, { status: 500 });
  }
}
