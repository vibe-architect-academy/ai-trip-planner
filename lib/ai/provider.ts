/**
 * Which model does what, and who to ask when the first choice is unavailable.
 *
 * Two separate decisions live here, and they are easy to confuse.
 *
 * **Right-sizing** is which model a task deserves. Writing a seven day
 * itinerary is the one job where quality is the product. Sorting a request
 * into "beach" or "city break" is a job a much cheaper model does just as
 * well, and it runs on every request. Paying itinerary prices for that is
 * most of a bill nobody can explain later.
 *
 * **The ladder** is what happens when a provider says no. The free tier has
 * limits, and the honest options when you hit one are to fail or to pay a
 * little. This falls through to DeepSeek, which is cheap enough that the
 * difference between a good day and a viral one is a rounding error.
 */

export type TaskKind = "itinerary" | "classify" | "summarize";

export type ProviderName = "gemini" | "deepseek";

type ModelChoice = {
  provider: ProviderName;
  model: string;
  /** Rough cost per million input tokens, for the note in the logs. */
  inputCostPerMillion: number;
  maxOutputTokens: number;
};

/**
 * The assignments, with the numbers that justify them.
 *
 * Prices move. These are here to make the ratio visible, not to be authoritative:
 * check the provider's pricing page before quoting them anywhere.
 */
const CHOICES: Record<TaskKind, ModelChoice[]> = {
  // The product. Worth the better model.
  itinerary: [
    { provider: "gemini", model: "gemini-2.5-flash", inputCostPerMillion: 0.3, maxOutputTokens: 2000 },
    { provider: "deepseek", model: "deepseek-chat", inputCostPerMillion: 0.27, maxOutputTokens: 2000 },
  ],
  // Runs on every request, and the answer is one word from a fixed list.
  classify: [
    { provider: "gemini", model: "gemini-2.5-flash-lite", inputCostPerMillion: 0.1, maxOutputTokens: 120 },
    { provider: "deepseek", model: "deepseek-chat", inputCostPerMillion: 0.27, maxOutputTokens: 120 },
  ],
  // One sentence. A big model here is paying for a cannon to open a letter.
  summarize: [
    { provider: "gemini", model: "gemini-2.5-flash-lite", inputCostPerMillion: 0.1, maxOutputTokens: 80 },
    { provider: "deepseek", model: "deepseek-chat", inputCostPerMillion: 0.27, maxOutputTokens: 80 },
  ],
};

export function keyFor(provider: ProviderName): string | undefined {
  return provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.DEEPSEEK_API_KEY;
}

/**
 * The providers to try for a task, in order, skipping any without a key.
 *
 * An empty result means no provider is configured at all, which callers treat
 * as "cannot do this right now" rather than as a failure to retry.
 */
export function ladderFor(task: TaskKind): ModelChoice[] {
  return CHOICES[task].filter((choice) => Boolean(keyFor(choice.provider)));
}

export function isAiConfigured(): boolean {
  return ladderFor("itinerary").length > 0;
}

/**
 * The fixed half of the itinerary instructions.
 *
 * Kept separate and kept first because it is identical on every request. Both
 * providers cache a stable prefix and charge less for the repeat, which only
 * works if the part that changes stays at the end. Putting the destination at
 * the top would defeat it on every single call.
 */
export const ITINERARY_SYSTEM_PROMPT = [
  "You are a travel planner. You write day-by-day itineraries using real,",
  "specific, currently-operating places, never invented ones.",
  "For each day give a morning activity, an afternoon activity, an evening",
  "activity, and a restaurant recommendation.",
  'Format: a heading per day like "### Day 1", then exactly 4 bullet points,',
  'each beginning with a bold label: "**Morning:**", "**Afternoon:**",',
  '"**Evening:**", "**Restaurant:**".',
  "No introduction, no closing remarks, no commentary. Start at Day 1.",
].join(" ");
