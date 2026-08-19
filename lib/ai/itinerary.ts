/**
 * Asking for the itinerary itself, down the ladder until someone answers.
 *
 * A note on structure versus streaming, because they pull against each other
 * and this app picks a side.
 *
 * Strict JSON is the right answer for the cheap tasks in classify.ts: nothing
 * is displayed while they run, so there is no cost to waiting for a complete
 * object. The itinerary is different. Watching it appear is most of what
 * makes the app feel alive, and a JSON object cannot be shown until its last
 * brace arrives. So the itinerary streams as text in a format the prompt
 * pins down hard, and the result is validated on the way out. Structure is
 * still enforced; it is just enforced by checking rather than by waiting.
 */

import { ladderFor, ITINERARY_SYSTEM_PROMPT, type ModelChoice } from "./provider";
import { readSseData, geminiTextFrom } from "@/lib/sse";
import { parseItinerary } from "@/lib/itinerary";
import { logError } from "@/lib/log";

export type ItineraryStream = {
  provider: string;
  model: string;
  chunks: AsyncIterable<string>;
};

function userPrompt(destination: string, days: number, language: string): string {
  // The variable half, and it goes last so the fixed half above it stays a
  // stable cacheable prefix.
  return [
    `Plan a ${days}-day trip to ${destination}.`,
    `Write it in ${language}, including the day headings.`,
  ].join(" ");
}

async function* geminiChunks(
  choice: ModelChoice,
  destination: string,
  days: number,
  language: string,
): AsyncGenerator<string> {
  const response = await fetch(
    `${choice.baseUrl}/models/${choice.model}:streamGenerateContent?alt=sse&key=${choice.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ITINERARY_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt(destination, days, language) }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: choice.maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`${choice.provider} ${choice.model} returned ${response.status}`);
  }

  for await (const payload of readSseData(response.body)) {
    const text = geminiTextFrom(payload);
    if (text) yield text;
  }
}

/**
 * The OpenAI chat-completions dialect, which Cerebras and DeepSeek both speak.
 *
 * One function rather than one per vendor. The differences between them are a
 * base URL and a model name, and writing a second near-identical client is how
 * a fix lands in one of them and not the other.
 */
async function* openAiChunks(
  choice: ModelChoice,
  destination: string,
  days: number,
  language: string,
): AsyncGenerator<string> {
  const response = await fetch(`${choice.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${choice.apiKey}`,
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: choice.model,
      stream: true,
      max_tokens: choice.maxOutputTokens,
      temperature: 0.7,
      ...choice.extraBody,
      messages: [
        { role: "system", content: ITINERARY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt(destination, days, language) },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`${choice.provider} ${choice.model} returned ${response.status}`);
  }

  // Same SSE reader as Gemini. Only the shape inside each event differs.
  for await (const payload of readSseData(response.body)) {
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    } catch {
      // A payload that is not JSON is not worth ending the stream over.
    }
  }
}

/**
 * The first provider that answers wins.
 *
 * Only the call that opens the stream falls down the ladder. Once text has
 * started arriving, a failure is handled by the caller keeping what it has,
 * because switching providers mid-itinerary would splice two different trips
 * together.
 */
export async function streamItinerary(input: {
  destination: string;
  days: number;
  language: string;
}): Promise<ItineraryStream> {
  const ladder = ladderFor("itinerary");
  if (!ladder.length) throw new Error("No AI provider is configured.");

  let lastError: unknown = null;

  for (const choice of ladder) {
    try {
      const chunks =
        choice.kind === "gemini"
          ? geminiChunks(choice, input.destination, input.days, input.language)
          : openAiChunks(choice, input.destination, input.days, input.language);

      // Pull the first chunk here, so a provider that is going to refuse does
      // so now, while falling through to the next one is still possible.
      const iterator = chunks[Symbol.asyncIterator]();
      const first = await iterator.next();

      async function* replay(): AsyncGenerator<string> {
        if (!first.done && first.value) yield first.value;
        while (true) {
          const next = await iterator.next();
          if (next.done) return;
          if (next.value) yield next.value;
        }
      }

      return { provider: choice.provider, model: choice.model, chunks: replay() };
    } catch (error) {
      lastError = error;
      logError("ai.itinerary_provider_failed", error, {
        provider: choice.provider,
        model: choice.model,
      });
    }
  }

  throw lastError ?? new Error("Every AI provider refused.");
}

export type ItineraryCheck = {
  ok: boolean;
  dayCount: number;
  problems: string[];
};

/**
 * Does this actually look like the thing we asked for?
 *
 * The check that matters is not "did the model reply" but "did it reply with
 * something the app can render". A chatty paragraph is a successful API call
 * and a broken page.
 */
export function checkItinerary(text: string, expectedDays: number): ItineraryCheck {
  const days = parseItinerary(text);
  const problems: string[] = [];

  if (days.length === 0) problems.push("no days found");
  if (days.length !== expectedDays) {
    problems.push(`expected ${expectedDays} days, found ${days.length}`);
  }

  const thin = days.filter((day) => day.items.length < 3).length;
  if (thin > 0) problems.push(`${thin} day(s) have fewer than 3 activities`);

  const unlabelled = days.filter((day) =>
    day.items.every((item) => item.label === ""),
  ).length;
  if (unlabelled > 0) problems.push(`${unlabelled} day(s) have no labelled activities`);

  return { ok: problems.length === 0, dayCount: days.length, problems };
}
