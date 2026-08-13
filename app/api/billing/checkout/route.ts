/**
 * Starts a Stripe Checkout session and hands back the URL.
 *
 * The price is built here, on the server, from our own constants. A price
 * that arrives in the request body is a price the customer chose, and someone
 * will eventually send you one cent.
 */

import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { stripe, isBillingConfigured } from "@/lib/billing/stripe";
import { PREMIUM_PRICE_CENTS, PREMIUM_CURRENCY } from "@/lib/billing/plans";
import { siteUrl } from "@/lib/site";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");

  if (!isBillingConfigured()) {
    return Response.json({ error: "Payments are not set up." }, { status: 500 });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: PREMIUM_CURRENCY,
            unit_amount: PREMIUM_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: "AI Trip Planner Premium",
              description: "Unlimited trips, up to 30 days, AI photo captions.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/pricing?upgraded=1`,
      cancel_url: `${siteUrl}/pricing`,
      /*
       * The link between a Stripe customer and a person in this app.
       *
       * client_reference_id survives the whole session and comes back on the
       * webhook, which is how the payment is matched to an account. Without
       * it you are left guessing from an email address, and the email someone
       * pays with is frequently not the one they signed up with.
       */
      client_reference_id: viewer.userId,
      metadata: { userId: viewer.userId },
      subscription_data: { metadata: { userId: viewer.userId } },
    });

    logInfo("billing.checkout_started", { userId: viewer.userId, sessionId: session.id });
    return Response.json({ url: session.url });
  } catch (error) {
    logError("billing.checkout_failed", error, { userId: viewer.userId });
    return Response.json({ error: "We could not start checkout." }, { status: 500 });
  }
}
