import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/observability";

/**
 * Browser-side error reporting.
 *
 * Worth having separately from the server: a page that throws in the browser
 * shows a blank screen and the server logs stay perfectly clean, which is the
 * most misleading state an app can be in.
 */
Sentry.init({
  ...sentryOptions,
  // Session replay is genuinely useful and also records the screen, so it is
  // deliberately not enabled here. This app shows someone's holiday plans and
  // their email address in the account menu.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
