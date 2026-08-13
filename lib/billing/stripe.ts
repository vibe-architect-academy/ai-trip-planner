import Stripe from "stripe";

/**
 * The Stripe client.
 *
 * Built on demand so a missing key stops a request rather than a build, and
 * so `next build` works on a machine that has never seen a Stripe key.
 */

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");

  /*
   * Refuse to start with a live key.
   *
   * This app takes no real money. A live key here would mean genuinely
   * charging someone during what everybody involved believes is a test, and
   * that is not a mistake you get to undo politely. The check costs one line.
   */
  if (!key.startsWith("sk_test_")) {
    throw new Error(
      "STRIPE_SECRET_KEY is not a test key. This app is test mode only, on purpose.",
    );
  }

  cached = new Stripe(key);
  return cached;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
