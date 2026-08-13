import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { trips, days, activities, type Trip } from "./schema";
import { parseItinerary } from "@/lib/itinerary";
import { canTransition, type TripState } from "@/lib/trip-state";

/**
 * Everything that reads or writes a trip.
 *
 * One rule runs through all of it: **the owner is part of the query, never a
 * check the caller is trusted to remember.** `getTrip(id)` does not exist here.
 * Only `getTrip(id, userId)` does, because a function that can return someone
 * else's trip will eventually be called by someone who forgot to check, and
 * that is not a bug you find in testing. You find it when a stranger sends you
 * a screenshot of a trip that was not theirs.
 */

export type TripWithDays = Trip & {
  days: Array<{
    id: string;
    position: number;
    heading: string;
    activities: Array<{ id: string; position: number; label: string; description: string }>;
  }>;
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** A short human title, so the list does not read as a wall of destinations. */
function titleFor(destination: string, dayCount: number): string {
  return `${dayCount}-day trip to ${destination}`;
}

export async function createTrip(input: {
  userId: string;
  destination: string;
  dayCount: number;
}): Promise<Trip> {
  const [trip] = await db()
    .insert(trips)
    .values({
      id: newId("trip"),
      userId: input.userId,
      destination: input.destination,
      dayCount: input.dayCount,
      title: titleFor(input.destination, input.dayCount),
      // Created and immediately generating. A trip that exists but has never
      // been asked for anything is a state nothing in this app produces.
      state: "generating",
    })
    .returning();

  return trip;
}

/**
 * Moves a trip from one state to another, refusing anything the table forbids.
 *
 * The current state is part of the WHERE clause, not something read first and
 * checked in code. Two requests arriving together would both pass a read-then-
 * check; only one of them can win an UPDATE that names the state it expects.
 *
 * Returns null when the move was refused, which is the caller's cue to answer
 * 409 rather than pretend it worked.
 */
export async function transitionTrip(input: {
  tripId: string;
  userId: string;
  from: TripState;
  to: TripState;
  extra?: Partial<{ sharedAt: Date | null }>;
}): Promise<Trip | null> {
  if (!canTransition(input.from, input.to)) return null;

  const [trip] = await db()
    .update(trips)
    .set({ state: input.to, updatedAt: new Date(), ...input.extra })
    .where(
      and(
        eq(trips.id, input.tripId),
        eq(trips.userId, input.userId),
        // The guard. If something already moved this trip, this matches
        // nothing and the update is a no-op instead of a silent overwrite.
        eq(trips.state, input.from),
      ),
    )
    .returning();

  return trip ?? null;
}

/**
 * The background job's only move: generating -> ready.
 *
 * Not scoped by user, because the worker has no session, and deliberately
 * narrow. If the owner archived the trip while the AI was still writing, this
 * matches nothing and the archive stands, rather than a finished job quietly
 * resurrecting a trip somebody put away.
 */
export async function markTripReady(tripId: string): Promise<boolean> {
  const rows = await db()
    .update(trips)
    .set({ state: "ready", updatedAt: new Date() })
    .where(and(eq(trips.id, tripId), eq(trips.state, "generating")))
    .returning({ id: trips.id });

  return rows.length > 0;
}

/**
 * Stores the finished itinerary, parsed into days and activities.
 *
 * Scoped by userId like everything else, so a wrong id writes nothing rather
 * than overwriting a stranger's trip.
 */
export async function saveItinerary(input: {
  tripId: string;
  userId: string;
  rawItinerary: string;
}): Promise<void> {
  const database = db();

  const updated = await database
    .update(trips)
    .set({ rawItinerary: input.rawItinerary, updatedAt: new Date() })
    .where(and(eq(trips.id, input.tripId), eq(trips.userId, input.userId)))
    .returning({ id: trips.id });

  if (!updated.length) return;

  // Regenerating replaces the previous breakdown. The cascade on days takes
  // the activities with them.
  await database.delete(days).where(eq(days.tripId, input.tripId));

  const parsed = parseItinerary(input.rawItinerary);
  if (!parsed.length) return;

  const dayRows = parsed.map((day, index) => ({
    id: newId("day"),
    tripId: input.tripId,
    position: index,
    heading: day.heading,
  }));
  await database.insert(days).values(dayRows);

  const activityRows = parsed.flatMap((day, dayIndex) =>
    day.items.map((item, itemIndex) => ({
      id: newId("act"),
      dayId: dayRows[dayIndex].id,
      position: itemIndex,
      label: item.label,
      description: item.text,
    })),
  );
  if (activityRows.length) await database.insert(activities).values(activityRows);
}

export async function listTrips(userId: string): Promise<Trip[]> {
  return db().query.trips.findMany({
    where: eq(trips.userId, userId),
    orderBy: [desc(trips.createdAt)],
  });
}

/**
 * One trip, or null.
 *
 * Null covers both "no such trip" and "not yours", and the caller answers 404
 * to both. Telling a stranger that a trip exists but is not theirs is still
 * telling them something about someone else.
 */
export async function getTrip(tripId: string, userId: string): Promise<TripWithDays | null> {
  const trip = await db().query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, userId)),
    with: {
      days: {
        orderBy: [days.position],
        with: { activities: { orderBy: [activities.position] } },
      },
    },
  });

  return (trip as TripWithDays | undefined) ?? null;
}

export async function deleteTrip(tripId: string, userId: string): Promise<boolean> {
  const deleted = await db()
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning({ id: trips.id });

  return deleted.length > 0;
}

/** How many trips each person has generated. Used by the admin page. */
export async function tripCountsByUser(): Promise<Map<string, number>> {
  const rows = await db()
    .select({ userId: trips.userId, count: sql<number>`count(*)::int` })
    .from(trips)
    .groupBy(trips.userId);

  return new Map(rows.map((row) => [row.userId, row.count]));
}
