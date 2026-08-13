/**
 * Server-side logging.
 *
 * The user gets a sentence they can act on. This is where the detail goes,
 * so that "it broke" at 3am is answerable rather than a shrug. Console for
 * now, which is enough while there is one server and one developer. Lesson 25
 * is where this grows into something that finds you instead of waiting to be
 * read.
 */

type Details = Record<string, unknown>;

export function logError(action: string, error: unknown, details: Details = {}) {
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
