import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * The shape of the data.
 *
 * A user has many trips, a trip has many days, a day has many activities.
 * That nesting is why this is a SQL database rather than a pile of JSON: the
 * questions worth asking later ("how many trips has this person generated",
 * "which destinations come up most") are joins, and joins are the thing SQL
 * is actually for.
 *
 * Note what is not here: no email, no name, no password. Clerk owns the person.
 * This owns what the person made. Copying profile data into a second place is
 * how you end up with two versions of the truth and no idea which is current.
 */

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    /** Clerk's user id. The only link between a person and their trips. */
    userId: text("user_id").notNull(),
    destination: text("destination").notNull(),
    dayCount: integer("day_count").notNull(),
    title: text("title"),
    /** The raw text the model produced, kept so a trip can be re-rendered. */
    rawItinerary: text("raw_itinerary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every read starts with "the trips belonging to this person", so this is
    // the index that keeps that fast once there are more than a handful.
    index("trips_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export const days = pgTable(
  "days",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      // Delete a trip and its days go with it. Without this you get orphans:
      // rows nobody can reach and nobody remembers to remove.
      .references(() => trips.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    heading: text("heading").notNull(),
  },
  (table) => [uniqueIndex("days_trip_position_idx").on(table.tripId, table.position)],
);

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    dayId: text("day_id")
      .notNull()
      .references(() => days.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** "Morning", "Restaurant", and so on. Empty when the model skipped it. */
    label: text("label").notNull().default(""),
    description: text("description").notNull(),
  },
  (table) => [uniqueIndex("activities_day_position_idx").on(table.dayId, table.position)],
);

export const tripsRelations = relations(trips, ({ many }) => ({
  days: many(days),
}));

export const daysRelations = relations(days, ({ one, many }) => ({
  trip: one(trips, { fields: [days.tripId], references: [trips.id] }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  day: one(days, { fields: [activities.dayId], references: [days.id] }),
}));

export type Trip = typeof trips.$inferSelect;
export type Day = typeof days.$inferSelect;
export type Activity = typeof activities.$inferSelect;
