/**
 * Stripe's webhook. The only thing in this app that grants paid access.
 *
 * Three rules, and every one of them exists because skipping it has cost
 * somebody real money:
 *
 * 1. **Fail closed.** An unsigned request grants nothing. This endpoint is
 *    public by necessity, so without the signature check it is a URL that
 *    hands out subscriptions to anyone who sends it the right JSON. Missing
 *    configuration is refused rather than waved through.
 *
 * 2. **Never trust the body over the signature.** The event is rebuilt from
 *    the raw bytes by the Stripe library, which verifies as it parses. The
 *    parsed body is only used after that succeeds.
 *
 * 3. **Idempotent.** Stripe delivers at least once and retries anything that
 *    does not answer 2xx. The event id is claimed in the database first, and a
 *    duplicate does nothing rather than granting a second month.
 */

import type Stripe from "stripe";
import { logError, logInfo } from "@/lib/log";
import { stripe, isBillingConfigured } from "@/lib/billing/stripe";
import { setPlan, claimEvent, releaseEvent } from "@/lib/db/billing";
import { isDatabaseConfigured } from "@/lib/db";
import { track, EVENTS } from "@/lib/analytics";

/** Events worth acting on. Everything else is acknowledged and ignored. */
const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function periodEnd(subscription: Stripe.Subscription): Date | null {
  // Stripe moved this onto the subscription items. Read the item, and fall
  // back to the old top-level field for older API versions.
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const seconds =
    item?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

export async function POST(request: Request) {
  // Unsigned requests are turned away first, before this endpoint admits
  // anything about its own configuration. A stranger probing gets a flat
  // refusal rather than a hint that they found something real.
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    logError("billing.webhook_unsigned", new Error("no stripe-signature header"));
    return Response.json({ error: "not allowed" }, { status: 400 });
  }

  if (!isBillingConfigured() || !isDatabaseConfigured()) {
    // Refused, not accepted-and-dropped. Answering 200 here would tell Stripe
    // the event was handled and it would never be sent again. A 500 means it
    // stays in Stripe's queue until this is fixed.
    logError("billing.webhook_misconfigured", new Error("billing or database not configured"));
    return Response.json({ error: "not configured" }, { status: 500 });
  }

  // Raw bytes. The signature covers exactly these, so parsing first and
  // re-serialising would never verify.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error) {
    // Includes replays: constructEvent enforces a timestamp tolerance, so an
    // old captured request cannot be sent again later.
    logError("billing.webhook_bad_signature", error);
    return Response.json({ error: "not allowed" }, { status: 400 });
  }

  try {
    if (!HANDLED.has(event.type)) {
      // 200, so Stripe stops sending it. Not being interested is not an error.
      return Response.json({ ignored: event.type });
    }

    let userId: string | null = null;
    let plan: "free" | "premium" = "free";
    let status = "active";
    let customerId: string | null = null;
    let subscriptionId: string | null = null;
    let endsAt: Date | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = session.client_reference_id ?? session.metadata?.userId ?? null;
      plan = "premium";
      customerId = typeof session.customer === "string" ? session.customer : null;
      subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      /*
       * Fetch the subscription to learn when this period ends.
       *
       * The checkout session does not carry it, so without this the very
       * first row written for every paying customer has a null period end.
       * That matters more than it looks: getPlan() only applies its "has this
       * lapsed" check when the date is present, so a null quietly disables
       * the one guard that stops a missed cancellation granting premium
       * forever. The guard would be switched off for precisely the customers
       * who just arrived.
       *
       * Failure here is not allowed to fail the webhook. The plan change is
       * the important part, a missing date is recoverable on the next
       * subscription event, and a 500 would make Stripe retry a payment we
       * have already granted.
       */
      if (subscriptionId) {
        try {
          const subscription = await stripe().subscriptions.retrieve(subscriptionId);
          endsAt = periodEnd(subscription);
        } catch (error) {
          logError("billing.period_end_lookup_failed", error, { subscriptionId });
        }
      }
    } else {
      const subscription = event.data.object as Stripe.Subscription;
      userId = subscription.metadata?.userId ?? null;
      customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      subscriptionId = subscription.id;
      status = subscription.status;
      endsAt = periodEnd(subscription);

      // Only these two statuses are worth paying for. Anything else, including
      // past_due and unpaid, drops back to free.
      plan =
        event.type === "customer.subscription.deleted"
          ? "free"
          : subscription.status === "active" || subscription.status === "trialing"
            ? "premium"
            : "free";
    }

    if (!userId) {
      // Nothing to grant this to. Logged loudly, because it means the id was
      // lost on the way out rather than on the way back.
      logError("billing.webhook_no_user", new Error("event carried no userId"), {
        eventId: event.id,
        type: event.type,
      });
      return Response.json({ ignored: "no user" });
    }

    // Claim first. If this event has already been handled, stop here.
    const isNew = await claimEvent({ eventId: event.id, type: event.type, userId });
    if (!isNew) {
      logInfo("billing.webhook_duplicate", { eventId: event.id, type: event.type });
      return Response.json({ duplicate: true });
    }

    await setPlan({
      userId,
      plan,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: endsAt,
    });

    // Recorded from the webhook, not from the browser landing on the success
    // page. The webhook is the moment money actually moved; a success page is
    // just a redirect somebody can visit by typing the URL.
    if (plan === "premium") {
      await track(userId, EVENTS.upgraded, { eventId: event.id });
    }

    logInfo("billing.plan_changed", { userId, plan, status, eventId: event.id });
    return Response.json({ ok: true });
  } catch (error) {
    /*
     * Give the claim back before asking for a retry.
     *
     * The claim is taken before the work, so a failure here would otherwise
     * leave the event marked handled while the plan was never set, and
     * Stripe's retry would see a duplicate and skip it. The customer would
     * have paid for something they never received, and the logs would say
     * everything went fine.
     */
    await releaseEvent(event.id).catch((releaseError) =>
      logError("billing.webhook_release_failed", releaseError, { eventId: event.id }),
    );

    // 500 so Stripe tries again.
    logError("billing.webhook_failed", error, { eventId: event.id, type: event.type });
    return Response.json({ error: "handler failed" }, { status: 500 });
  }
}
