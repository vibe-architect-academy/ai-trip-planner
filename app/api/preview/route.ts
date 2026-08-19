/**
 * Plan a trip without an account.
 *
 * The landing page's whole job is to be tried before it is trusted, which
 * means the first itinerary has to arrive before anyone has signed up for
 * anything. This writes a preview rather than a trip: no owner, expires in a
 * day, and worth nothing until somebody claims it.
 *
 * Everything expensive about this route is spent on a stranger, so the limits
 * here are not a formality. They are the reason the route can exist.
 */

import { logError, logInfo } from "@/lib/log";
import { streamItinerary, checkItinerary } from "@/lib/ai/itinerary";
import { isAiConfigured } from "@/lib/ai/provider";
import { isDatabaseConfigured } from "@/lib/db";
import { createPreview, savePreviewItinerary } from "@/lib/db/previews";
import { consume, subjectFromRequest, tooManyRequests } from "@/lib/rate-limit";
import { getLocale, languageForPrompt } from "@/lib/i18n";

export const maxDuration = 120;

/**
 * Shorter than the free plan allows on purpose.
 *
 * A signed-in free user gets five days. A visitor gets three, because three is
 * enough to see that the thing works and the difference is a reason to make an
 * account. Being generous here would leave nothing to sign up for.
 */
const PREVIEW_MAX_DAYS = 3;

/** Per visitor, per hour. Enough to try a few cities, not enough to script. */
const PER_IP_HOURLY = 5;
/** Per visitor, per day. */
const PER_IP_DAILY = 15;
/**
 * Everyone, per day.
 *
 * The free model budget is finite and shared. Without this, one determined
 * afternoon from a handful of addresses spends the whole allowance and the
 * signed-in users, who are the ones that matter, get nothing.
 */
const GLOBAL_DAILY = 200;

const HOUR = 3600;
const DAY = 86400;

function line(value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value) + "\n");
}

export async function POST(request: Request) {
  let destination = "";
  let dayCount = 0;

  try {
    if (!isAiConfigured() || !isDatabaseConfigured()) {
      logError("preview.misconfigured", new Error("no AI provider or no database"));
      return Response.json(
        { error: "We cannot plan trips right now. Try again shortly." },
        { status: 500 },
      );
    }

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
    if (dayCount > PREVIEW_MAX_DAYS) {
      return Response.json(
        {
          error: `Trips up to ${PREVIEW_MAX_DAYS} days without an account. Sign in for longer ones.`,
          signIn: true,
        },
        { status: 403 },
      );
    }

    /*
     * Counted before a single token is spent, and counted whether or not the
     * model then answers. A limiter that only counts successes is one you can
     * drain for free by making it fail.
     *
     * It sits below the validation above on purpose. A typo should not cost
     * somebody their hourly allowance, and a malformed request costs nothing
     * to refuse: no model call, no row, no round trip.
     */
    const subject = subjectFromRequest(request);

    const hourly = await consume("preview:h", subject, PER_IP_HOURLY, HOUR);
    if (!hourly.ok) {
      return tooManyRequests(
        "That is a lot of trips for one hour. Sign in to keep going.",
        hourly.resetIn,
      );
    }

    const daily = await consume("preview:d", subject, PER_IP_DAILY, DAY);
    if (!daily.ok) {
      return tooManyRequests(
        "That is today's limit for planning without an account. Sign in to keep going.",
        daily.resetIn,
      );
    }

    const global = await consume("preview:global", "all", GLOBAL_DAILY, DAY);
    if (!global.ok) {
      logInfo("preview.global_cap_reached", { cap: GLOBAL_DAILY });
      return tooManyRequests(
        "The free demo has had a busy day. Sign in and yours is planned right now.",
        global.resetIn,
      );
    }

    const language = languageForPrompt(await getLocale());
    const preview = await createPreview({ destination, dayCount });

    let source;
    try {
      source = await streamItinerary({ destination, days: dayCount, language });
    } catch (error) {
      logError("preview.no_provider_answered", error, { previewId: preview.id });
      return Response.json(
        { error: "The trip planner could not plan that one. Try again." },
        { status: 502 },
      );
    }

    let itinerary = "";

    const stream = new ReadableStream({
      async start(controller) {
        // The claim token goes out before the first word, so the Save button
        // knows what it would be saving while it is still being written.
        controller.enqueue(line({ previewId: preview.id }));

        try {
          for await (const text of source.chunks) {
            itinerary += text;
            controller.enqueue(line({ text }));
          }

          if (!itinerary.trim()) {
            logError("preview.empty_response", new Error("AI streamed no text"), {
              previewId: preview.id,
            });
            controller.enqueue(
              line({ error: "The trip planner came back empty handed. Try again." }),
            );
            return;
          }

          const check = checkItinerary(itinerary, dayCount);
          if (!check.ok) {
            logError("preview.shape_off", new Error(check.problems.join("; ")), {
              previewId: preview.id,
              model: source.model,
            });
          }

          await savePreviewItinerary({ previewId: preview.id, rawItinerary: itinerary });
          controller.enqueue(line({ complete: true }));

          logInfo("preview.created", {
            previewId: preview.id,
            provider: source.provider,
            model: source.model,
            characters: itinerary.length,
          });
        } catch (error) {
          logError("preview.stream_broke", error, { previewId: preview.id });
          if (itinerary.trim()) {
            await savePreviewItinerary({
              previewId: preview.id,
              rawItinerary: itinerary,
            }).catch((saveError) =>
              logError("preview.partial_save_failed", saveError, { previewId: preview.id }),
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
    logError("preview.unhandled", error, { destination, dayCount });
    return Response.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
