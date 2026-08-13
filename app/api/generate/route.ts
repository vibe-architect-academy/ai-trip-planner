/**
 * The kitchen.
 *
 * This file never runs in the browser. It runs on the server, which is the
 * only reason GEMINI_API_KEY is safe to read here. The browser sends a
 * destination and a number of days, and gets back an itinerary. It has no
 * idea which AI produced it, or that there is a key involved at all.
 */

import { logError, logInfo } from "@/lib/log";

const MODEL = "gemini-2.5-flash";

/** How long to wait on the AI before giving up and telling the user so. */
const UPSTREAM_TIMEOUT_MS = 15_000;

function buildPrompt(destination: string, days: number): string {
  return [
    `Plan a ${days}-day trip to ${destination}.`,
    "For each day give a morning activity, an afternoon activity, an evening",
    "activity, and a restaurant recommendation, with specific real places.",
    'Format: a heading per day like "### Day 1", then 4 short bullet points.',
    "No intro or outro text, start directly with Day 1.",
  ].join(" ");
}

export async function POST(request: Request) {
  let destination = "";
  let days = 0;

  try {
    // Validate what the caller sent before anything else. A bad request is the
    // caller's problem whether or not the server happens to be configured, and
    // answering 500 to a request that was never valid just sends people hunting
    // for a server fault that does not exist.
    let body: { destination?: unknown; days?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "That request did not make sense." }, { status: 400 });
    }

    destination = String(body.destination ?? "").trim();
    days = Number(body.days);

    if (!destination) {
      return Response.json({ error: "Tell me where you want to go." }, { status: 400 });
    }
    if (destination.length > 60) {
      return Response.json({ error: "That destination is too long." }, { status: 400 });
    }
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return Response.json({ error: "Pick between 1 and 7 days." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logError("generate.misconfigured", new Error("GEMINI_API_KEY is not set"));
      return Response.json(
        { error: "We cannot plan trips right now. Try again shortly." },
        { status: 500 },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(destination, days) }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            // Thinking is on by default for 2.5 Flash, and it buys nothing here
            // except a long silence before the first word.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } catch (error) {
      // Timed out, or the AI service is unreachable. Same story to the user.
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logError("generate.upstream_unreachable", error, { destination, days, timedOut });
      return Response.json(
        {
          error: timedOut
            ? "That is taking longer than usual. Give it another try."
            : "We could not reach the trip planner. Try again in a moment.",
        },
        { status: 504 },
      );
    }

    if (!upstream.ok) {
      // Full detail to the log, one sentence to the user.
      logError("generate.upstream_error", new Error(`AI returned ${upstream.status}`), {
        destination,
        days,
        status: upstream.status,
        body: (await upstream.text()).slice(0, 2000),
      });
      return Response.json(
        { error: "The trip planner could not plan that one. Try again." },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    const itinerary: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // The AI answered, but not with anything usable. This happens, and a blank
    // panel with no explanation is the worst possible way to hear about it.
    if (!itinerary.trim()) {
      logError("generate.empty_response", new Error("No itinerary text in AI response"), {
        destination,
        days,
        shape: Object.keys(data ?? {}),
      });
      return Response.json(
        { error: "The trip planner came back empty handed. Try again." },
        { status: 502 },
      );
    }

    logInfo("generate.ok", { destination, days, characters: itinerary.length });
    return Response.json({ destination, days, itinerary });
  } catch (error) {
    // The catch-all. Whatever went wrong here was not anticipated, so it gets
    // logged in full and the user still gets a sentence rather than a stack.
    logError("generate.unhandled", error, { destination, days });
    return Response.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
