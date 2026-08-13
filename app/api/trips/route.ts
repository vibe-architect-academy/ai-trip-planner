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
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { streamItinerary, checkItinerary } from "@/lib/ai/itinerary";
import { isAiConfigured } from "@/lib/ai/provider";
import { describeTrip } from "@/lib/ai/classify";
import { getAllowance } from "@/lib/db/billing";
import { limitMessage } from "@/lib/billing/plans";
import { createTrip, listTrips, saveItinerary, markTripReady } from "@/lib/db/trips";
import { isDatabaseConfigured } from "@/lib/db";
import { getLocale, languageForPrompt } from "@/lib/i18n";

export const maxDuration = 120;

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
    if (!Number.isInteger(dayCount) || dayCount < 1) {
      return Response.json({ error: "Pick at least one day." }, { status: 400 });
    }

    /*
     * The limits, enforced here.
     *
     * The UI also shows them, but the UI is a suggestion: anyone can call
     * this endpoint directly. If the paywall only exists in the browser then
     * it is decoration, and the first person to open the network tab gets
     * premium for nothing.
     */
    const allowance = await getAllowance(viewer.userId);

    if (!allowance.canCreate) {
      // 402 Payment Required, which is precisely what this is.
      return Response.json(
        { error: limitMessage("trips"), plan: allowance.plan, upgrade: true },
        { status: 402 },
      );
    }

    if (dayCount > allowance.maxDays) {
      return Response.json(
        { error: limitMessage("days"), plan: allowance.plan, upgrade: true },
        { status: 402 },
      );
    }

    if (!isAiConfigured() || !isDatabaseConfigured()) {
      logError("trips.misconfigured", new Error("no AI provider or no database"));
      return Response.json(
        { error: "We cannot plan trips right now. Try again shortly." },
        { status: 500 },
      );
    }

    const language = languageForPrompt(await getLocale());
    const trip = await createTrip({ userId: viewer.userId, destination, dayCount });

    let source;
    try {
      source = await streamItinerary({ destination, days: dayCount, language });
    } catch (error) {
      logError("trips.no_provider_answered", error, { tripId: trip.id });
      return Response.json(
        { error: "The trip planner could not plan that one. Try again." },
        { status: 502 },
      );
    }

    const userId = viewer.userId;
    let itinerary = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send the id first so the browser can link to the trip immediately,
        // before a single word of it has been written.
        controller.enqueue(line({ tripId: trip.id }));

        try {
          for await (const text of source.chunks) {
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
            /*
             * Did we get the thing we asked for, or just a reply? A chatty
             * paragraph is a successful API call and a broken page, so this
             * is checked rather than assumed. It is logged rather than
             * refused: the text is already on the reader's screen, and
             * snatching it back over a missing label helps nobody.
             */
            const check = checkItinerary(itinerary, dayCount);
            if (!check.ok) {
              logError("trips.shape_off", new Error(check.problems.join("; ")), {
                tripId: trip.id,
                model: source.model,
              });
            }

            await saveItinerary({ tripId: trip.id, userId, rawItinerary: itinerary });
            // generating -> ready, and only from generating. If the owner
            // archived this while the AI was still writing, this does nothing
            // and the archive stands.
            const becameReady = await markTripReady(trip.id);
            controller.enqueue(line({ saved: true, state: becameReady ? "ready" : null }));
            logInfo("trips.created", {
              userId,
              tripId: trip.id,
              provider: source.provider,
              model: source.model,
              characters: itinerary.length,
            });

            // The cheap model's turn, after the reader already has what they
            // came for. A label is a nice-to-have and is never allowed to
            // delay or break the thing that matters.
            describeTrip({ destination, days: dayCount }).catch(() => null);
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
