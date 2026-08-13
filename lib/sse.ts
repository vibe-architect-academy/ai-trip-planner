/**
 * Reading a Server-Sent Events stream.
 *
 * Pulled out of the route on purpose: this is the part with the sharp edges,
 * and sharp edges deserve to be testable on their own.
 *
 * Two things go wrong if you write this inline and eyeball it. A network chunk
 * can end in the middle of a JSON object, so anything that parses per chunk
 * will throw on perfectly good data. And a chunk can split a multi-byte
 * character in half, so anything that decodes per chunk without `stream: true`
 * produces mojibake in exactly the languages nobody tests in.
 */

/** Splits a byte stream into whole SSE `data:` payloads, in order. */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  // `stream: true` on each decode is what keeps split characters intact.
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Keep the trailing fragment. It is the half-finished line, and it only
      // becomes parseable once the rest of it arrives.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== "[DONE]") yield payload;
      }
    }

    // Whatever is left after the stream closes, if it was a complete line.
    const last = buffer.trim();
    if (last.startsWith("data:")) {
      const payload = last.slice(5).trim();
      if (payload && payload !== "[DONE]") yield payload;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Pulls the text out of one Gemini stream event, or "" if it carries none. */
export function geminiTextFrom(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    // A payload that is not JSON is not worth killing the stream over.
    return "";
  }
}
