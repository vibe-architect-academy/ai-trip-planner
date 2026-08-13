/**
 * What each plan allows.
 *
 * One table, consulted everywhere. The limits used to be scattered as numbers
 * in whichever file needed them, which is how the pricing page and the code
 * end up disagreeing about what you get, and the pricing page is the one
 * customers read.
 */

export type Plan = "free" | "premium";

export type Limits = {
  /** Trips per calendar month. Infinity on premium. */
  tripsPerMonth: number;
  /** Longest trip, in days. */
  maxDays: number;
  /** Whether uploaded photos get an AI caption. */
  photoCaptions: boolean;
};

export const LIMITS: Record<Plan, Limits> = {
  free: { tripsPerMonth: 3, maxDays: 5, photoCaptions: false },
  premium: { tripsPerMonth: Infinity, maxDays: 30, photoCaptions: true },
};

export const PREMIUM_PRICE_CENTS = 1000;
export const PREMIUM_CURRENCY = "usd";

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "premium";
}

export function limitsFor(plan: Plan): Limits {
  return LIMITS[plan];
}

/** The upgrade nudge, phrased as what they get rather than what they lack. */
export function limitMessage(kind: "trips" | "days"): string {
  if (kind === "trips") {
    return `You have used all ${LIMITS.free.tripsPerMonth} free trips this month. Premium is unlimited.`;
  }
  return `Free trips go up to ${LIMITS.free.maxDays} days. Premium goes to ${LIMITS.premium.maxDays}.`;
}
