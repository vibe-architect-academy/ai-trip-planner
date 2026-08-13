import * as Sentry from "@sentry/nextjs";

/**
 * Shared Sentry settings, so the three entry points cannot drift apart.
 *
 * Everything here is a no-op without SENTRY_DSN, which is deliberate: local
 * development and preview builds should not be filling up a production issue
 * feed with errors nobody is going to act on.
 */

export const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export const sentryOptions: Sentry.NodeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnabled,
  environment: process.env.VERCEL_ENV ?? "development",
  // 10% of traces. Enough to see how slow things are without paying to record
  // every single request, which at this size nobody would ever read.
  tracesSampleRate: 0.1,

  /**
   * The last chance to stop something private leaving the building.
   *
   * An error report carries URLs, headers and whatever context was attached,
   * and a share token in a URL is a working credential. Scrubbing here is
   * cheaper than explaining later why a support tool had a link that opened
   * someone's holiday.
   */
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.replace(
        /\/share\/[A-Za-z0-9]+/,
        "/share/[token]",
      );
    }

    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers["stripe-signature"];
      delete event.request.headers["upstash-signature"];
    }

    return event;
  },
};
