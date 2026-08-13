/**
 * The kitchen.
 *
 * This file never runs in the browser. It runs on the server, which is the
 * only reason GEMINI_API_KEY is safe to read here. The browser sends a
 * destination and a number of days, and gets the itinerary back as it is
 * written, a few words at a time.
 */

import { logError, logInfo } from "@/lib/log";
import { readSseData, geminiTextFrom } from "@/lib/sse";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";

const MODEL = "gemini-2.5-flash";

/**
 * How long this function is allowed to run before the platform kills it.
 *
 * A seven day itinerary can take the better part of a minute. The Vercel
 * default is far shorter than that, and a request that gets cut off halfway
 * looks exactly like a bug to whoever was waiting. Two minutes is comfortable
 * headroom, not a target.
 */
export const maxDuration = 120;

/** How long to wait for the AI to say its first word before giving up. */
const UPSTREAM_TIMEOUT_MS = 20_000;

function buildPrompt(destination: string, days: number): string {
  return [
    `Plan a ${days}-day trip to ${destination}.`,
    "For each day give a morning activity, an afternoon activity, an evening",
    "activity, and a restaurant recommendation, with specific real places.",
    'Format: a heading per day like "### Day 1", then 4 short bullet points.',
    "No intro or outro text, start directly with Day 1.",
  ].join(" ");
}

/** One line of newline-delimited JSON. The browser reads these as they land. */
function line(value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value) + "\n");
}

export async function POST(request: Request) {
  let destination = "";
  let days = 0;

  try {
    // Ask again, here, even though the middleware already turned away anyone
    // without a session. The middleware protects the route; this protects the
    // work. Generating costs money, and "who is spending it" is a question the
    // handler has to be able to answer on its own.
    const viewer = await getViewer();
    if (!viewer) return unauthorized();
    if (viewer.banned) return forbidden("This account has been suspended.");

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

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}` +
      `:streamGenerateContent?alt=sse&key=${apiKey}`;

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
            // Thinking is on by default for 2.5 Flash, and here it buys nothing
            // except a long silence before the first word. The entire point of
            // this lesson is that the first word arrives quickly.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } catch (error) {
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

    if (!upstream.ok || !upstream.body) {
      logError("generate.upstream_error", new Error(`AI returned ${upstream.status}`), {
        destination,
        days,
        status: upstream.status,
        body: (await upstream.text().catch(() => "")).slice(0, 2000),
      });
      return Response.json(
        { error: "The trip planner could not plan that one. Try again." },
        { status: 502 },
      );
    }

    const upstreamBody = upstream.body;
    let characters = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const payload of readSseData(upstreamBody)) {
            const text = geminiTextFrom(payload);
            if (!text) continue;
            characters += text.length;
            controller.enqueue(line({ text }));
          }

          if (characters === 0) {
            logError("generate.empty_response", new Error("AI streamed no text"), {
              destination,
              days,
            });
            controller.enqueue(
              line({ error: "The trip planner came back empty handed. Try again." }),
            );
          } else {
            logInfo("generate.ok", { userId: viewer.userId, destination, days, characters });
          }
        } catch (error) {
          // The stream broke partway. The browser already has real text on
          // screen, so send an error line rather than throwing it all away.
          logError("generate.stream_broke", error, { destination, days, characters });
          controller.enqueue(
            line({ error: "The connection dropped partway through this trip." }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        // Tells proxies not to sit on the response waiting for it to finish,
        // which would undo the entire point of streaming.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logError("generate.unhandled", error, { destination, days });
    return Response.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
