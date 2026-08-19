/**
 * Any job URL that does not exist. Answered loudly, on purpose.
 *
 * Next answers a POST to a route it does not have with **200** and an HTML
 * body. A GET correctly gets a 404; a POST does not. That is survivable for a
 * page and genuinely dangerous for a queue, because QStash reads 200 as
 * "delivered, done" and retires the message. Mistype a worker URL in a
 * schedule and every run reports success while nothing whatsoever happens,
 * for as long as nobody thinks to check.
 *
 * A catch-all costs a few lines and turns that silence into a 404 in the
 * QStash log. Real routes are more specific than this one, so they still win.
 *
 * There is no signature check here. That is deliberate: this path can never
 * do work, so the only thing to protect is the truth of the status code.
 */

function notFound(): Response {
  return Response.json(
    { error: "There is no job at this URL." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
