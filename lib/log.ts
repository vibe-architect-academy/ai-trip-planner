/**
 * Server-side logging.
 *
 * The user gets a sentence they can act on. This is where the detail goes, so
 * that "it broke" at 3am is answerable rather than a shrug.
 *
 * Errors go to two places on purpose. The console is for reading while you
 * work; Sentry is for being told when you are not looking. Logs alone mean
 * every problem waits until somebody happens to check, which in practice
 * means until a user complains.
 */

import * as Sentry from "@sentry/nextjs";

type Details = Record<string, unknown>;

export function logError(action: string, error: unknown, details: Details = {}) {
  /*
   * Console for reading, Sentry for being told. A log nobody opens is not
   * monitoring; it is a diary you write for an audience of nobody.
   *
   * Guarded, because the error reporter must never be the thing that throws.
   * Outside a Next runtime, in a script or a test, captureException may not
   * exist at all, and an unguarded call turns every handled error into an
   * unhandled one while hiding the original fault behind a crash in the code
   * that was supposed to record it.
   */
  try {
    Sentry?.captureException?.(error, { tags: { action }, extra: details });
  } catch {
    // Reporting failed. The console line below is still the important half.
  }

  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      level: "error",
      action,
      message: error instanceof Error ? error.message : String(error),
      // The stack is the part that actually locates the fault.
      stack: error instanceof Error ? error.stack : undefined,
      ...details,
    }),
  );
}

export function logInfo(action: string, details: Details = {}) {
  console.log(
    JSON.stringify({ at: new Date().toISOString(), level: "info", action, ...details }),
  );
}
