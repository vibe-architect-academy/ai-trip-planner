import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/observability";

/**
 * Server-side error reporting, started before anything else runs.
 *
 * Next calls this once per runtime. The runtime check matters: the edge
 * runtime has no Node APIs, so initialising the same way in both is how you
 * get an error inside your error reporter.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions);
  }
}

/** Next hands server-side render errors here so they are not swallowed. */
export const onRequestError = Sentry.captureRequestError;
