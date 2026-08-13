/**
 * Put a failed photo back in the queue.
 *
 * Scoped to the owner like everything else, so this cannot be used to make
 * somebody else's account do work.
 */

import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { resetPhotoForRetry, ownsTrip } from "@/lib/db/photos";
import { isDatabaseConfigured } from "@/lib/db";
import { enqueuePhoto, isQueueConfigured } from "@/lib/queue";

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured() || !isQueueConfigured()) {
    return Response.json({ error: "Retrying is unavailable right now." }, { status: 500 });
  }

  const { id, photoId } = await params;

  try {
    if (!(await ownsTrip(id, viewer.userId))) {
      return Response.json({ error: "No such trip." }, { status: 404 });
    }

    const reset = await resetPhotoForRetry(photoId, viewer.userId);
    if (!reset) return Response.json({ error: "No such photo." }, { status: 404 });

    const messageId = await enqueuePhoto(photoId);
    logInfo("photos.retried", { userId: viewer.userId, photoId, messageId });

    return Response.json({ retrying: true });
  } catch (error) {
    logError("photos.retry_failed", error, { userId: viewer.userId, photoId });
    return Response.json({ error: "We could not retry that photo." }, { status: 500 });
  }
}
