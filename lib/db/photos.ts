import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { photos, trips, type Photo } from "./schema";

/** Same rule as trips: the owner is part of the query, never a later check. */

export type PhotoStatus = "processing" | "ready" | "failed";

/** How many times a photo is picked up before it is given up on. */
export const MAX_ATTEMPTS = 3;

function newId(): string {
  return `pho_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** True only if this trip exists AND belongs to this user. */
export async function ownsTrip(tripId: string, userId: string): Promise<boolean> {
  const found = await db().query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, userId)),
    columns: { id: true },
  });
  return Boolean(found);
}

export async function addPhoto(input: {
  tripId: string;
  userId: string;
  url: string;
  pathname: string;
}): Promise<Photo> {
  const [photo] = await db()
    .insert(photos)
    .values({
      id: newId(),
      tripId: input.tripId,
      userId: input.userId,
      url: input.url,
      pathname: input.pathname,
      status: "processing",
    })
    .returning();

  return photo;
}

export async function listPhotos(tripId: string, userId: string): Promise<Photo[]> {
  return db().query.photos.findMany({
    where: and(eq(photos.tripId, tripId), eq(photos.userId, userId)),
    orderBy: [asc(photos.createdAt)],
  });
}

export async function countPhotos(tripId: string, userId: string): Promise<number> {
  return (await listPhotos(tripId, userId)).length;
}

/**
 * A photo by id, with no owner scoping.
 *
 * The one deliberate exception, and it exists for the background worker, which
 * is not a person and has no session. Every route that serves a human uses the
 * scoped functions above. Nothing that answers a browser should call this.
 */
export async function getPhotoForWorker(photoId: string): Promise<Photo | null> {
  const photo = await db().query.photos.findFirst({ where: eq(photos.id, photoId) });
  return photo ?? null;
}

/** Marks an attempt as started and returns the new count. */
export async function recordAttempt(photoId: string): Promise<number> {
  const [row] = await db()
    .update(photos)
    .set({ attempts: sql`${photos.attempts} + 1` })
    .where(eq(photos.id, photoId))
    .returning({ attempts: photos.attempts });

  return row?.attempts ?? 0;
}

export async function markPhotoReady(input: {
  photoId: string;
  url: string;
  pathname: string;
  caption: string;
}): Promise<void> {
  await db()
    .update(photos)
    .set({
      url: input.url,
      pathname: input.pathname,
      caption: input.caption,
      status: "ready",
      lastError: null,
    })
    .where(eq(photos.id, input.photoId));
}

export async function markPhotoFailed(photoId: string, reason: string): Promise<void> {
  await db()
    .update(photos)
    .set({ status: "failed", lastError: reason.slice(0, 500) })
    .where(eq(photos.id, photoId));
}

/** Puts a failed photo back in the queue's reach. Used by the Retry button. */
export async function resetPhotoForRetry(photoId: string, userId: string): Promise<boolean> {
  const [row] = await db()
    .update(photos)
    .set({ status: "processing", attempts: 0, lastError: null })
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
    .returning({ id: photos.id });

  return Boolean(row);
}
