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
    /**
     * Where this trip is in its lifecycle. See lib/trip-state.ts, which owns
     * the transitions. Stored as text rather than an enum so adding a state
     * later is a code change, not a migration that locks the table.
     */
    state: text("state").notNull().default("draft"),
    /** When it was shared, so an unshare can be told from never-shared. */
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    /**
     * The unguessable half of a share link.
     *
     * The trip id is short and appears in the owner's own URLs, so it is not
     * a secret. This is generated separately and is the only thing that opens
     * the public page, which means unsharing can revoke it by clearing it.
     */
    shareToken: text("share_token"),
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

export const photos = pgTable(
  "photos",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    /**
     * Denormalised on purpose. Every photo read starts with "is this yours",
     * and carrying the owner here answers that without a join back to trips.
     */
    userId: text("user_id").notNull(),
    /** The Blob URL. The file itself is never in the database. */
    url: text("url").notNull(),
    /** Blob's own path, which is what deletion needs. */
    pathname: text("pathname").notNull(),
    caption: text("caption"),
    /**
     * processing -> ready, or processing -> failed once the retries are spent.
     *
     * A photo is visible the moment it is uploaded, and the slow work happens
     * afterwards, so the row has to be able to say "here, but not finished".
     */
    status: text("status").notNull().default("processing"),
    /** How many times a worker has picked this up. Bounds the retrying. */
    attempts: integer("attempts").notNull().default(0),
    /** Kept for the logs when a photo ends up failed. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("photos_trip_id_idx").on(table.tripId)],
);

export const tripsRelations = relations(trips, ({ many }) => ({
  days: many(days),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  trip: one(trips, { fields: [photos.tripId], references: [trips.id] }),
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
export type Photo = typeof photos.$inferSelect;

/**
 * What someone is entitled to, and the receipts behind it.
 *
 * Kept in our database rather than read from Stripe on every request. Stripe
 * is the truth about money; this is the truth about access, and the app has to
 * be able to answer "can this person do this" without a network call to a
 * third party that might be down.
 */
export const subscriptions = pgTable("subscriptions", {
  /** Clerk's user id. One row per person, which is why it is the key. */
  userId: text("user_id").primaryKey(),
  /** "free" or "premium". Everything gates on this one word. */
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** When access lapses if they cancel. Null on the free plan. */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Every webhook event that has been acted on.
 *
 * The primary key is Stripe's event id, which is the whole point. Stripe
 * delivers at least once and will happily send the same event twice; an insert
 * that collides here means "already handled", and the second delivery does
 * nothing instead of granting a second month.
 */
export const paymentEvents = pgTable("payment_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  userId: text("user_id"),
  handledAt: timestamp("handled_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;

/**
 * A trip generated by somebody who has not signed in.
 *
 * The landing page has to work before anyone has an account, or the first
 * thing a visitor meets is a sign-up form asking them to trust something they
 * have not seen yet. So an anonymous visitor gets a real itinerary, written by
 * the real model, and it lands here rather than in `trips`.
 *
 * Deliberately a separate table. The alternative is a nullable `user_id` on
 * `trips`, which sounds tidier and quietly destroys the rule the whole app
 * rests on: that a trip is always somebody's, and the owner is part of every
 * query. One nullable column and "where user_id = ?" starts silently matching
 * nothing instead of failing loudly.
 *
 * The id is the claim token. It is a UUID, so it cannot be guessed, and it is
 * the only thing that turns a preview into a saved trip.
 */
export const previews = pgTable(
  "previews",
  {
    id: text("id").primaryKey(),
    destination: text("destination").notNull(),
    dayCount: integer("day_count").notNull(),
    rawItinerary: text("raw_itinerary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Previews are litter. They clean themselves up rather than accumulating. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("previews_expires_at_idx").on(table.expiresAt)],
);

/**
 * Fixed-window request counters.
 *
 * Anonymous generation spends real money on somebody else's behalf, and the
 * person spending it has no account to suspend. A counter is the difference
 * between a demo and a free AI proxy for whoever finds it first.
 *
 * In Postgres rather than in memory, because there is no "in memory" here.
 * Every request may land on a different serverless instance, so a counter held
 * in a module variable protects exactly one lambda and nothing else.
 */
export const rateLimits = pgTable("rate_limits", {
  /** bucket + subject + window start, e.g. "preview:a3f9…:486123". */
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type Preview = typeof previews.$inferSelect;
