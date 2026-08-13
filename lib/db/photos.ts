import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { photos, trips, type Photo } from "./schema";

/** Same rule as trips: the owner is part of the query, never a later check. */

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
  caption?: string;
}): Promise<Photo> {
  const [photo] = await db()
    .insert(photos)
    .values({
      id: newId(),
      tripId: input.tripId,
      userId: input.userId,
      url: input.url,
      pathname: input.pathname,
      caption: input.caption ?? null,
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
