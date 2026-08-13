/**
 * Trips: list them, and create one.
 *
 * Creating a trip and generating its itinerary are one request. The trip row
 * is written first, then the itinerary streams to the browser while it is
 * being written, and the finished text is saved when the stream ends. That
 * ordering matters: if the connection dies halfway, the trip still exists and
 * can be regenerated, rather than the work vanishing.
 */

import { logError, logInfo } from "@/lib/log";
import { readSseData, geminiTextFrom } from "@/lib/sse";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { createTrip, listTrips, saveItinerary, markTripReady } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";
import { getLocale, languageForPrompt } from "@/lib/i18n";

const MODEL = "gemini-2.5-flash";
export const maxDuration = 120;
const UPSTREAM_TIMEOUT_MS = 20_000;

function buildPrompt(destination: string, days: number, language: string): string {
  return [
    `Plan a ${days}-day trip to ${destination}.`,
    "For each day give a morning activity, an afternoon activity, an evening",
    "activity, and a restaurant recommendation, with specific real places.",
    'Format: a heading per day like "### Day 1", then 4 short bullet points.',
    "No intro or outro text, start directly with Day 1.",
    // Translating the buttons and leaving the itinerary in English is a half
    // finished job. The content is the part they came for.
    `Write the entire itinerary in ${language}, including the day headings.`,
  ].join(" ");
}

function line(value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value) + "\n");
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  try {
    return Response.json(
      { trips: await listTrips(viewer.userId) },
      {
        // Never cached, anywhere, by anyone. This answer is different for
        // every person who asks, and a personal response sitting in a shared
        // cache is how one user's trips get served to the next one.
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    logError("trips.list_failed", error, { userId: viewer.userId });
    return Response.json({ error: "We could not load your trips." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let destination = "";
  let dayCount = 0;

  try {
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
    dayCount = Number(body.days);

    if (!destination) {
      return Response.json({ error: "Tell me where you want to go." }, { status: 400 });
    }
    if (destination.length > 60) {
      return Response.json({ error: "That destination is too long." }, { status: 400 });
    }
    if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) {
      return Response.json({ error: "Pick between 1 and 7 days." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !isDatabaseConfigured()) {
      logError(
        "trips.misconfigured",
        new Error(`missing ${!apiKey ? "GEMINI_API_KEY" : "DATABASE_URL"}`),
      );
      return Response.json(
        { error: "We cannot plan trips right now. Try again shortly." },
        { status: 500 },
      );
    }

    const language = languageForPrompt(await getLocale());
    const trip = await createTrip({ userId: viewer.userId, destination, dayCount });

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
          contents: [{ parts: [{ text: buildPrompt(destination, dayCount, language) }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logError("trips.upstream_unreachable", error, { tripId: trip.id, timedOut });
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
      logError("trips.upstream_error", new Error(`AI returned ${upstream.status}`), {
        tripId: trip.id,
        status: upstream.status,
        body: (await upstream.text().catch(() => "")).slice(0, 2000),
      });
      return Response.json(
        { error: "The trip planner could not plan that one. Try again." },
        { status: 502 },
      );
    }

    const upstreamBody = upstream.body;
    const userId = viewer.userId;
    let itinerary = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send the id first so the browser can link to the trip immediately,
        // before a single word of it has been written.
        controller.enqueue(line({ tripId: trip.id }));

        try {
          for await (const payload of readSseData(upstreamBody)) {
            const text = geminiTextFrom(payload);
            if (!text) continue;
            itinerary += text;
            controller.enqueue(line({ text }));
          }

          if (!itinerary.trim()) {
            logError("trips.empty_response", new Error("AI streamed no text"), {
              tripId: trip.id,
            });
            controller.enqueue(
              line({ error: "The trip planner came back empty handed. Try again." }),
            );
          } else {
            await saveItinerary({ tripId: trip.id, userId, rawItinerary: itinerary });
            // generating -> ready, and only from generating. If the owner
            // archived this while the AI was still writing, this does nothing
            // and the archive stands.
            const becameReady = await markTripReady(trip.id);
            controller.enqueue(line({ saved: true, state: becameReady ? "ready" : null }));
            logInfo("trips.created", { userId, tripId: trip.id, characters: itinerary.length });
          }
        } catch (error) {
          logError("trips.stream_broke", error, { tripId: trip.id });
          // Keep whatever arrived. A partial trip beats a lost one.
          if (itinerary.trim()) {
            await saveItinerary({ tripId: trip.id, userId, rawItinerary: itinerary }).catch(
              (saveError) => logError("trips.partial_save_failed", saveError, { tripId: trip.id }),
            );
          }
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
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logError("trips.unhandled", error, { destination, dayCount });
    return Response.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
