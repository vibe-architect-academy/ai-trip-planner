import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./index";
import { subscriptions, paymentEvents, trips } from "./schema";
import { type Plan, isPlan, limitsFor } from "@/lib/billing/plans";

/** Reading and writing what someone is entitled to. */

export async function getPlan(userId: string): Promise<Plan> {
  const row = await db().query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!row || row.status !== "active") return "free";
  // A subscription that has lapsed is not a premium subscription, whatever the
  // plan column says. Checking the date here means a missed webhook degrades
  // to free rather than granting access forever.
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < Date.now()) return "free";

  return isPlan(row.plan) ? row.plan : "free";
}

export async function setPlan(input: {
  userId: string;
  plan: Plan;
  status?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}): Promise<void> {
  await db()
    .insert(subscriptions)
    .values({
      userId: input.userId,
      plan: input.plan,
      status: input.status ?? "active",
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan: input.plan,
        status: input.status ?? "active",
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Records that an event has been handled, and says whether it is new.
 *
 * False means this exact event has already been acted on, so the caller should
 * stop. Stripe delivers at least once, and without this a retried
 * `checkout.session.completed` grants a second month for free.
 */
export async function claimEvent(input: {
  eventId: string;
  type: string;
  userId?: string | null;
}): Promise<boolean> {
  const inserted = await db()
    .insert(paymentEvents)
    .values({ eventId: input.eventId, type: input.type, userId: input.userId ?? null })
    .onConflictDoNothing()
    .returning({ eventId: paymentEvents.eventId });

  return inserted.length > 0;
}

/**
 * Undoes a claim, so a retry of the same event is allowed to run.
 *
 * Needed because the claim is taken before the work. If the work then fails,
 * leaving the claim in place would mean Stripe's retry sees "already handled"
 * and skips it, and the customer has paid for a plan that was never granted.
 * The claim only means "handled" once the handling actually finished.
 */
export async function releaseEvent(eventId: string): Promise<void> {
  await db().delete(paymentEvents).where(eq(paymentEvents.eventId, eventId));
}

/** Trips created since the start of this calendar month. */
export async function tripsThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [row] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(trips)
    .where(and(eq(trips.userId, userId), gte(trips.createdAt, startOfMonth)));

  return row?.count ?? 0;
}

export type Allowance = {
  plan: Plan;
  used: number;
  limit: number;
  maxDays: number;
  canCreate: boolean;
};

/** Everything a caller needs to decide whether to allow another trip. */
export async function getAllowance(userId: string): Promise<Allowance> {
  const plan = await getPlan(userId);
  const limits = limitsFor(plan);
  const used = await tripsThisMonth(userId);

  return {
    plan,
    used,
    limit: limits.tripsPerMonth,
    maxDays: limits.maxDays,
    canCreate: used < limits.tripsPerMonth,
  };
}
