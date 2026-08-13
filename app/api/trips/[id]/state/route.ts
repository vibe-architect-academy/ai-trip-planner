/**
 * Move a trip through its lifecycle.
 *
 * One route for share, unshare, archive and unarchive, because they are the
 * same operation with different arguments, and four routes that each did their
 * own state check is exactly how the checks drift apart.
 */

import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import {
  getTrip,
  transitionTrip,
  setShareToken,
  newShareToken,
} from "@/lib/db/trips";
import { sendShareInvite, isEmailConfigured } from "@/lib/email/send";
import { viewerLabel } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { track, EVENTS } from "@/lib/analytics";
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

    /*
     * The token is minted only after the state machine agreed to the move,
     * and cleared as soon as the trip stops being shared. Revoking has to
     * actually revoke: a link that keeps working after "stop sharing" is a
     * worse lie than never having offered the button.
     */
    let shareUrl: string | null = null;

    if (action.to === "shared") {
      const token = newShareToken();
      await setShareToken({ tripId: id, userId: viewer.userId, token });
      shareUrl = `${siteUrl}/share/${token}`;
    } else if (from === "shared") {
      await setShareToken({ tripId: id, userId: viewer.userId, token: null });
    }

    logInfo("trip.transition", {
      userId: viewer.userId,
      tripId: id,
      from,
      to: action.to,
    });

    if (action.to === "shared") {
      track(viewer.userId, EVENTS.tripShared, { tripId: id, viaEmail: Boolean(body.email) });
    }

    // The invite goes out while they are watching, so a failure is theirs to
    // see rather than something they find out about from a silent partner.
    let emailed: boolean | null = null;
    const partnerEmail = String(body.email ?? "").trim();

    if (shareUrl && partnerEmail && isEmailConfigured()) {
      const result = await sendShareInvite({
        to: partnerEmail,
        fromName: await viewerLabel(),
        tripTitle: trip.title ?? trip.destination,
        shareUrl,
      });
      emailed = result.sent;
    }

    return Response.json({ state: moved.state, shareUrl, emailed });
  } catch (error) {
    logError("trip.transition_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "We could not do that." }, { status: 500 });
  }
}
