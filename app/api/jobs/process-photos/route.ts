/**
 * The worker. One photo per call.
 *
 * QStash calls this some time after an upload. It resizes, asks the AI for a
 * caption, saves the finished file, and replaces the raw one. None of that
 * happens while a person waits, which is the whole point.
 *
 * "One photo per call" is not an implementation detail. A job that processes
 * twenty photos fails as a unit: one bad file and the other nineteen are lost
 * with it, and a retry redoes work that already succeeded. One unit of work
 * per message means a failure is one photo's problem.
 */

import sharp from "sharp";
import { put, del } from "@vercel/blob";
import { logError, logInfo } from "@/lib/log";
import {
  getPhotoForWorker,
  markPhotoReady,
  markPhotoFailed,
  recordAttempt,
  MAX_ATTEMPTS,
} from "@/lib/db/photos";
import { isDatabaseConfigured } from "@/lib/db";
import { getPlan } from "@/lib/db/billing";
import { limitsFor } from "@/lib/billing/plans";
import { isFromQueue } from "@/lib/queue";

export const maxDuration = 120;

/** Long side, in pixels. A phone photo is several times this and nothing needs it. */
const MAX_EDGE = 1200;

const MODEL = "gemini-2.5-flash";

async function captionFor(imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Write one short caption for this travel photo, under 12 words. " +
                  "Describe what is actually visible. No hashtags, no quotes.",
              },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );

  if (!response.ok) throw new Error(`caption model returned ${response.status}`);

  const data = await response.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

export async function POST(request: Request) {
  let photoId = "";

  try {
    /*
     * Read the body as text first, because the signature covers the exact
     * bytes that were sent. Parsing to JSON and re-serialising produces a
     * different string, and it will not verify.
     */
    const raw = await request.text();

    /*
     * The signature is checked before anything else, including whether this
     * server is even configured. Answering "not configured" to an unsigned
     * caller tells a stranger the endpoint is real and something about its
     * state; a flat refusal tells them nothing.
     */
    if (!(await isFromQueue(request, raw))) {
      logError("photos.job_unsigned", new Error("bad or missing QStash signature"));
      return Response.json({ error: "not allowed" }, { status: 401 });
    }

    if (!isDatabaseConfigured()) {
      return Response.json({ error: "not configured" }, { status: 500 });
    }

    const body = JSON.parse(raw || "{}");
    photoId = String(body.photoId ?? "");
    if (!photoId) return Response.json({ error: "no photoId" }, { status: 400 });

    const photo = await getPhotoForWorker(photoId);
    // Gone, or already done. Answer 200 so QStash stops retrying: this is not
    // a failure, there is simply nothing left to do.
    if (!photo) return Response.json({ skipped: "no such photo" });
    if (photo.status === "ready") return Response.json({ skipped: "already done" });

    const attempts = await recordAttempt(photoId);

    const source = await fetch(photo.url, { signal: AbortSignal.timeout(20_000) });
    if (!source.ok) throw new Error(`could not fetch the raw upload: ${source.status}`);
    const original = Buffer.from(await source.arrayBuffer());

    // `withoutEnlargement` matters: a small photo should stay its own size
    // rather than being blown up to 1200 and looking worse than it arrived.
    const resized = await sharp(original)
      .rotate() // Honour the EXIF orientation, or phone photos land sideways.
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    // Captions are a premium feature, so the plan is checked before spending
    // an AI call rather than after. The resize happens for everyone.
    const plan = await getPlan(photo.userId);
    let caption = "";
    try {
      if (limitsFor(plan).photoCaptions) {
        caption = await captionFor(resized.toString("base64"), "image/jpeg");
      }
    } catch (error) {
      // A missing caption is a worse photo, not a failed one. Losing the
      // resize because the caption model was busy would be the wrong trade.
      logError("photos.caption_failed", error, { photoId });
    }

    const finished = await put(`trips/${photo.tripId}/${photoId}.jpg`, resized, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });

    await markPhotoReady({
      photoId,
      url: finished.url,
      pathname: finished.pathname,
      caption,
    });

    // The raw upload has been replaced, so stop paying to store it. Last,
    // and allowed to fail: an orphaned file is cheaper than a lost photo.
    await del(photo.pathname).catch((error) =>
      logError("photos.raw_cleanup_failed", error, { photoId }),
    );

    logInfo("photos.processed", {
      photoId,
      attempts,
      originalBytes: original.length,
      finalBytes: resized.length,
      captioned: Boolean(caption),
    });

    return Response.json({ ok: true });
  } catch (error) {
    logError("photos.job_failed", error, { photoId });

    // Decide whether this is worth another go. QStash retries on a non-2xx,
    // so returning 500 asks for one and 200 accepts defeat.
    const photo = photoId ? await getPhotoForWorker(photoId).catch(() => null) : null;
    const spent = (photo?.attempts ?? 0) >= MAX_ATTEMPTS;

    if (spent && photoId) {
      await markPhotoFailed(
        photoId,
        error instanceof Error ? error.message : String(error),
      ).catch(() => {});
      return Response.json({ failed: true, retrying: false });
    }

    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
