import { Client, Receiver } from "@upstash/qstash";
import { siteUrl } from "./site";

/**
 * The queue.
 *
 * QStash is a postman, not a worker. You hand it a URL and a payload, it
 * answers immediately, and some time later it makes an HTTP request to that
 * URL. The work still happens in your own code; what changes is that the
 * person who uploaded a photo is no longer sitting there waiting for it.
 *
 * The catch that surprises everyone: QStash can only call a public URL. It
 * cannot reach localhost, so this path is genuinely testable only on a
 * deployed app or through a tunnel.
 */

let cached: Client | null = null;

function client(): Client {
  if (cached) return cached;
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set.");

  /*
   * QStash runs in more than one region and the SDK only knows about one of
   * them. Leave baseUrl unset and every message goes to the EU endpoint, no
   * matter which region issued your token.
   *
   * That is worth saying plainly because of how it fails. The token is not
   * valid in the other region, so the failure is an authentication error on a
   * request you can see leaving, which reads as "my token is wrong" rather
   * than "my token is fine and I am talking to the wrong continent".
   *
   * Unset, this falls back to the SDK default, which is what a student
   * following the EU quickstart wants.
   */
  const baseUrl = process.env.QSTASH_URL;
  cached = new Client(baseUrl ? { token, baseUrl } : { token });
  return cached;
}

export function isQueueConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

/**
 * Ask for one photo to be processed, later.
 *
 * Returns the message id so it can go in the logs. A caller that cannot
 * publish should not fail the upload: the photo is already saved, and a
 * photo stuck as "processing" is a far better outcome than an upload that
 * appeared to fail after the file was accepted.
 */
export async function enqueuePhoto(photoId: string): Promise<string> {
  const { messageId } = await client().publishJSON({
    url: `${siteUrl}/api/jobs/process-photos`,
    body: { photoId },
    // Three attempts, spaced out by QStash. Most failures here are the AI
    // service being briefly busy, and those fix themselves given a moment.
    retries: 3,
    /*
     * Ten deliveries a minute, across everybody, and at most two at once.
     *
     * This is the number that stops one person uploading twenty photos from
     * spending the whole AI quota and making the app fail for everyone else
     * at the same time. The limit belongs here rather than in the worker,
     * because the worker only ever sees the message it was handed and has no
     * idea how many others are in flight.
     *
     * `rate` with `period` rather than `ratePerSecond`, which is deprecated
     * and would have meant writing ten-per-minute as the fraction 0.1666.
     */
    flowControl: { key: "photo-captions", rate: 10, period: "1m", parallelism: 2 },
  });

  return messageId;
}

let receiver: Receiver | null = null;

/**
 * Proves a request really came from QStash.
 *
 * Without this the worker is a public URL that does paid AI work on demand,
 * and the only thing standing between it and a stranger's script is that
 * nobody has guessed the path yet. QStash signs every request; this checks
 * the signature against the two rotating keys it publishes.
 *
 * Returns false when the keys are missing, which fails closed. An
 * unverifiable request is refused rather than waved through.
 */
export async function isFromQueue(request: Request, body: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return false;

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  receiver ??= new Receiver({ currentSigningKey, nextSigningKey });

  try {
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
