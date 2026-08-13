import { PostHog } from "posthog-node";

/**
 * Product analytics: what people actually do, as opposed to what broke.
 *
 * Sentry answers "is it working". This answers "is it working *for them*",
 * which is a different question with a different shape of answer. An app can
 * be flawlessly healthy and still lose everybody between signing up and
 * finishing their first trip, and nothing in an error tracker would ever say
 * so.
 *
 * The events are named after things a person did, not after code that ran.
 * `trip_generated` survives a rewrite of the route that emits it;
 * `handleGenerateSuccess` does not, and a funnel built on it breaks silently
 * the day somebody renames a function.
 */

export const EVENTS = {
  signedUp: "signed_up",
  tripStarted: "trip_started",
  tripGenerated: "trip_generated",
  photoUploaded: "photo_uploaded",
  tripShared: "trip_shared",
  upgraded: "upgraded_to_premium",
  limitHit: "hit_free_limit",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

let client: PostHog | null = null;

export function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function posthog(): PostHog | null {
  if (!isAnalyticsConfigured()) return null;
  client ??= new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    // Send immediately. Batching is the right default for a long-lived
    // server, and exactly wrong for a serverless function that gets frozen a
    // moment after it answers, taking the unsent batch with it.
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Records something a person did.
 *
 * Fire-and-forget, and never allowed to throw. No analytics call should be
 * able to fail a request: measuring the thing must not break the thing.
 */
export async function track(
  userId: string,
  event: EventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const posthogClient = posthog();
  if (!posthogClient) return;

  try {
    posthogClient.capture({ distinctId: userId, event, properties });
    await posthogClient.flush();
  } catch {
    // Deliberately silent. An analytics outage is not a user-facing problem,
    // and reporting it as one would make it into a much worse one.
  }
}

/**
 * The funnel this app actually cares about.
 *
 * Written down because a funnel that only exists in a dashboard is a funnel
 * nobody can see in the code, and the events quietly stop being emitted.
 *
 *   landed -> trip_started -> trip_generated -> trip_shared
 *
 * The step that matters is the last one. A shared trip is the moment this
 * stops being a toy someone tried and becomes something they showed a person
 * they are actually going travelling with.
 */
export const CORE_FUNNEL: EventName[] = [
  EVENTS.tripStarted,
  EVENTS.tripGenerated,
  EVENTS.tripShared,
];
