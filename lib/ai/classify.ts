/**
 * The cheap, high-volume calls: what kind of trip is this, and summarise it.
 *
 * Both ask for structured output rather than prose, and the difference is not
 * cosmetic. "It sounds like a relaxing beach holiday!" is a sentence a
 * program cannot use. `{"tripType":"beach"}` is a value it can store, filter
 * and count. Asking for the shape you need is cheaper than parsing the shape
 * you were given.
 */

import { ladderFor, keyFor, type ProviderName } from "./provider";
import { logError, logInfo } from "@/lib/log";

export const TRIP_TYPES = [
  "beach",
  "city-break",
  "family",
  "luxury",
  "adventure",
  "budget",
  "other",
] as const;

export type TripType = (typeof TRIP_TYPES)[number];

type Structured = { tripType: TripType; summary: string };

const SCHEMA = {
  type: "object",
  properties: {
    tripType: { type: "string", enum: [...TRIP_TYPES] },
    summary: { type: "string" },
  },
  required: ["tripType", "summary"],
} as const;

async function askGemini(
  model: string,
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
          // Ask for JSON and hand over the schema, so the model is constrained
          // rather than merely instructed. Instructions get ignored; schemas
          // are enforced by the provider.
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`gemini ${model} returned ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function askDeepSeek(
  model: string,
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.2,
      // DeepSeek speaks the OpenAI dialect, which has JSON mode but not a
      // schema, so the shape is described in the prompt and validated below.
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`deepseek ${model} returned ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Anything the model sends that is not the agreed shape is treated as a miss. */
function parse(text: string): Structured | null {
  try {
    const parsed = JSON.parse(text);
    const tripType = String(parsed?.tripType ?? "");
    const summary = String(parsed?.summary ?? "").trim();
    if (!TRIP_TYPES.includes(tripType as TripType) || !summary) return null;
    return { tripType: tripType as TripType, summary: summary.slice(0, 200) };
  } catch {
    return null;
  }
}

/**
 * Classify and summarise in a single call.
 *
 * These were two separate jobs and are now one, because two calls means two
 * lots of latency and two lots of the same input tokens for answers that come
 * from reading the same sentence.
 *
 * Never throws. This is a nice-to-have on top of a trip that already exists,
 * and no part of the app should fail because a label could not be produced.
 */
export async function describeTrip(input: {
  destination: string;
  days: number;
}): Promise<Structured | null> {
  const prompt = [
    `A traveller asked for a ${input.days}-day trip to ${input.destination}.`,
    `Reply as JSON with "tripType" (one of: ${TRIP_TYPES.join(", ")})`,
    'and "summary", a single sentence under 20 words describing the trip.',
  ].join(" ");

  for (const choice of ladderFor("classify")) {
    const apiKey = keyFor(choice.provider as ProviderName);
    if (!apiKey) continue;

    try {
      const text =
        choice.provider === "gemini"
          ? await askGemini(choice.model, apiKey, prompt, choice.maxOutputTokens)
          : await askDeepSeek(choice.model, apiKey, prompt, choice.maxOutputTokens);

      const parsed = parse(text);
      if (parsed) {
        logInfo("ai.classified", { provider: choice.provider, model: choice.model });
        return parsed;
      }

      logError(
        "ai.classify_bad_shape",
        new Error("model did not return the agreed structure"),
        { provider: choice.provider, model: choice.model },
      );
    } catch (error) {
      // Try the next rung. A provider being busy is not a reason to give up.
      logError("ai.classify_failed", error, { provider: choice.provider, model: choice.model });
    }
  }

  return null;
}
