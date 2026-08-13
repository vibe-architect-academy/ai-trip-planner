import { Client } from "@upstash/qstash";
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
  });

  return messageId;
}
