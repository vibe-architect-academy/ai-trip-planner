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
 * **The ladder** is who to ask, in order, skipping anyone without a key. Free
 * tiers refuse without warning, and the honest options at that moment are to
 * fail or to pay a little.
 *
 * The ladder's order is configuration, not code. `AI_PROVIDER_ORDER` sets it,
 * because the right first choice depends on whose account is paying, and that
 * is a deployment fact rather than an architectural one. See docs/ai.md.
 */

export type TaskKind = "itinerary" | "classify" | "summarize";

export type ProviderName = "gemini" | "cerebras" | "deepseek";

type Provider = {
  /**
   * How to talk to it. Gemini has its own request shape; everyone else here
   * speaks the OpenAI chat-completions dialect, so one client covers them.
   */
  kind: "gemini" | "openai";
  baseUrl: string;
  envKey: string;
  /** Which model handles which task. See right-sizing, above. */
  models: Record<TaskKind, string>;
  /** Rough cost per million input tokens, so the logs can say what was spent. */
  inputCostPerMillion: number;
};

/**
 * Prices and free-tier limits move. These are here to make the ratios visible,
 * not to be authoritative. Check the provider's own page before quoting them.
 */
const PROVIDERS: Record<ProviderName, Provider> = {
  gemini: {
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    envKey: "GEMINI_API_KEY",
    models: {
      itinerary: "gemini-2.5-flash",
      classify: "gemini-2.5-flash-lite",
      summarize: "gemini-2.5-flash-lite",
    },
    inputCostPerMillion: 0.3,
  },
  cerebras: {
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    models: {
      itinerary: "gpt-oss-120b",
      // The small tasks are a label and a sentence. A 120b model here would be
      // a cannon opening a letter, and it spends the same rate limit.
      classify: "gemma-4-31b",
      summarize: "gemma-4-31b",
    },
    inputCostPerMillion: 0,
  },
  deepseek: {
    kind: "openai",
    baseUrl: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
    models: {
      itinerary: "deepseek-chat",
      classify: "deepseek-chat",
      summarize: "deepseek-chat",
    },
    inputCostPerMillion: 0.27,
  },
};

/** Output ceilings by task, so a one-word answer cannot bill like an essay. */
const MAX_OUTPUT_TOKENS: Record<TaskKind, number> = {
  itinerary: 2000,
  classify: 20,
  summarize: 80,
};

/**
 * The default order matches what the course teaches: Gemini first, then a free
 * fallback, then a paid floor. A deployment whose Google account has billing
 * enabled has no free tier at all and should set AI_PROVIDER_ORDER to put a
 * genuinely free provider first.
 */
const DEFAULT_ORDER: ProviderName[] = ["gemini", "cerebras", "deepseek"];

function isProviderName(value: string): value is ProviderName {
  return value === "gemini" || value === "cerebras" || value === "deepseek";
}

/** The configured order, ignoring anything unrecognised rather than crashing. */
export function providerOrder(): ProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER;
  if (!raw) return DEFAULT_ORDER;

  const named = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(isProviderName);

  // Anything left out still goes on the end, so setting one name does not
  // silently switch off every other provider you are paying for.
  return [...named, ...DEFAULT_ORDER.filter((name) => !named.includes(name))];
}

export function keyFor(provider: ProviderName): string | undefined {
  return process.env[PROVIDERS[provider].envKey];
}

export type ModelChoice = {
  provider: ProviderName;
  kind: "gemini" | "openai";
  baseUrl: string;
  model: string;
  apiKey: string;
  maxOutputTokens: number;
  inputCostPerMillion: number;
};

/**
 * Who to ask for this task, in order, skipping anyone without a key.
 *
 * An empty result means nothing is configured at all, which callers treat as
 * "cannot do this right now" rather than as a failure worth retrying.
 */
export function ladderFor(task: TaskKind): ModelChoice[] {
  return providerOrder()
    .map((name) => ({ name, apiKey: keyFor(name) }))
    .filter((entry): entry is { name: ProviderName; apiKey: string } => Boolean(entry.apiKey))
    .map(({ name, apiKey }) => {
      const provider = PROVIDERS[name];
      return {
        provider: name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.models[task],
        apiKey,
        maxOutputTokens: MAX_OUTPUT_TOKENS[task],
        inputCostPerMillion: provider.inputCostPerMillion,
      };
    });
}

export function isAiConfigured(): boolean {
  return ladderFor("itinerary").length > 0;
}

/**
 * The fixed half of the itinerary instructions.
 *
 * Kept separate and kept first because it is identical on every request. Both
 * dialects cache a stable prefix and charge less for the repeat, which only
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
