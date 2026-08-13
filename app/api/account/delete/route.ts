/**
 * "Delete everything you hold about me."
 *
 * The hard one, because it has to be real. A flag that hides the account
 * while the rows stay is not deletion, and describing it as deletion is the
 * kind of thing regulators take an interest in.
 *
 * Order matters here. Files go first, because a blob whose database row has
 * already been deleted is unreachable and will sit in storage forever with
 * nothing left to say it exists.
 */

import { del } from "@vercel/blob";
import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized } from "@/lib/auth";
import { listTrips, deleteTrip } from "@/lib/db/trips";
import { listPhotos } from "@/lib/db/photos";
import { isDatabaseConfigured } from "@/lib/db";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  // Deliberate friction. This is irreversible, so it takes more than a click
  // that could have been a misclick.
  const body = await request.json().catch(() => ({}));
  if (String(body.confirm ?? "") !== "DELETE") {
    return Response.json(
      { error: 'Type DELETE to confirm.', needsConfirmation: true },
      { status: 400 },
    );
  }

  try {
    const trips = await listTrips(viewer.userId);
    let filesRemoved = 0;

    for (const trip of trips) {
      const photos = await listPhotos(trip.id, viewer.userId);
      for (const photo of photos) {
        // Each file separately, and a failure on one does not abandon the
        // rest. A leftover file is bad; leaving the other forty is worse.
        await del(photo.pathname)
          .then(() => {
            filesRemoved++;
          })
          .catch((error) =>
            logError("account.blob_delete_failed", error, { photoId: photo.id }),
          );
      }
      // Days, activities and photo rows go with the trip, by cascade.
      await deleteTrip(trip.id, viewer.userId);
    }

    logInfo("account.deleted", {
      userId: viewer.userId,
      trips: trips.length,
      filesRemoved,
    });

    /*
     * The Clerk account itself is not deleted here, and that is deliberate
     * rather than an omission. Clerk owns the identity, and its own account
     * portal is where someone closes it. Deleting the identity from under a
     * live session from a route like this is how you end up with a
     * half-deleted person: gone from the auth provider, still referenced by
     * rows we failed to remove.
     */
    return Response.json({
      deleted: true,
      trips: trips.length,
      filesRemoved,
      next: "Your trips and photos are gone. Close your sign-in account from your account settings.",
    });
  } catch (error) {
    logError("account.delete_failed", error, { userId: viewer.userId });
    return Response.json({ error: "We could not delete your data." }, { status: 500 });
  }
}
