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

export type ProviderName = "gemini" | "groq" | "cerebras" | "deepseek";

/**
 * One model, and anything only it needs in the request body.
 *
 * Per model rather than per provider, because "OpenAI-compatible" does not
 * mean every model accepts the same options. reasoning_effort is required by
 * the gpt-oss models and rejected outright by compound.
 */
type ModelSpec = {
  id: string;
  extraBody?: Record<string, unknown>;
};

type Provider = {
  /**
   * How to talk to it. Gemini has its own request shape; everyone else here
   * speaks the OpenAI chat-completions dialect, so one client covers them.
   */
  kind: "gemini" | "openai";
  baseUrl: string;
  envKey: string;
  /**
   * Which models handle which task, in fallback order.
   *
   * More than one, because rate limits are per model. Groq gives each its own
   * bucket, so falling from one to the next multiplies the free capacity
   * without involving a second vendor: roughly 80 itineraries a day on the
   * flagship, another 80 on the small one, and 250 more on compound, which
   * has no daily token cap at all.
   */
  models: Record<TaskKind, ModelSpec[]>;
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
      itinerary: [{ id: "gemini-2.5-flash" }],
      classify: [{ id: "gemini-2.5-flash-lite" }],
      summarize: [{ id: "gemini-2.5-flash-lite" }],
    },
    inputCostPerMillion: 0.3,
  },
  groq: {
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    models: {
      /*
       * Quality first, then headroom. The flagship writes the best itinerary
       * and has the tightest daily token budget, so when it runs out the
       * small model takes over, and compound last because it is slower but
       * has no daily token cap.
       *
       * Two models were tried and rejected. qwen3.6-27b ignores the heading
       * format entirely and returns zero parseable days. allam-2-7b formats
       * perfectly and invents facts: it placed Kabuki-za in Kyoto when it is
       * in Tokyo, and put Kikunoi in the wrong district. Correct shape with
       * wrong content is worse than an obvious failure, because nothing
       * catches it.
       */
      itinerary: [
        { id: "openai/gpt-oss-120b", extraBody: { reasoning_effort: "low" } },
        { id: "openai/gpt-oss-20b", extraBody: { reasoning_effort: "low" } },
        // Rejects reasoning_effort, hence no extraBody.
        { id: "groq/compound" },
      ],
      classify: [
        { id: "openai/gpt-oss-20b", extraBody: { reasoning_effort: "low" } },
        { id: "openai/gpt-oss-120b", extraBody: { reasoning_effort: "low" } },
      ],
      summarize: [
        { id: "openai/gpt-oss-20b", extraBody: { reasoning_effort: "low" } },
      ],
    },
    inputCostPerMillion: 0.15,
  },
  cerebras: {
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    models: {
      itinerary: [{ id: "gpt-oss-120b" }],
      // The small tasks are a label and a sentence. A 120b model here would be
      // a cannon opening a letter, and it spends the same rate limit.
      classify: [{ id: "gemma-4-31b" }],
      summarize: [{ id: "gemma-4-31b" }],
    },
    inputCostPerMillion: 0,
  },
  deepseek: {
    kind: "openai",
    baseUrl: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
    models: {
      itinerary: [{ id: "deepseek-chat" }],
      classify: [{ id: "deepseek-chat" }],
      summarize: [{ id: "deepseek-chat" }],
    },
    inputCostPerMillion: 0.27,
  },
};

/** Output ceilings by task, so a one-word answer cannot bill like an essay. */
/*
 * Ceilings, with headroom for reasoning tokens.
 *
 * The cheap tasks want a word and a sentence, so 20 and 80 looked generous.
 * On a reasoning model they are not: the thinking is billed against the same
 * budget and silently leaves nothing for the answer. These are sized so the
 * reasoning fits and the answer still arrives, and they remain small enough
 * that a one-word reply cannot bill like an essay.
 */
const MAX_OUTPUT_TOKENS: Record<TaskKind, number> = {
  itinerary: 2000,
  classify: 250,
  summarize: 250,
};

/**
 * The default order matches what the course teaches: Gemini first, then the
 * alternatives, then a paid floor.
 *
 * Worth knowing before you rely on any of them being free. Gemini's free tier
 * exists only on a Google Cloud project with billing disabled. Cerebras looks
 * free and is not: with a zero balance every call returns 402, whatever the
 * quotas on its limits page suggest. Test a provider with one real request
 * before believing a pricing page, including the ones above.
 */
const DEFAULT_ORDER: ProviderName[] = ["gemini", "groq", "cerebras", "deepseek"];

function isProviderName(value: string): value is ProviderName {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "cerebras" ||
    value === "deepseek"
  );
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
  extraBody: Record<string, unknown>;
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
    .flatMap(({ name, apiKey }) => {
      const provider = PROVIDERS[name];
      // One rung per model, not per provider. Rate limits are per model, so a
      // provider with three usable models is three chances, not one.
      return provider.models[task].map((spec) => ({
        provider: name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: spec.id,
        apiKey,
        maxOutputTokens: MAX_OUTPUT_TOKENS[task],
        inputCostPerMillion: provider.inputCostPerMillion,
        extraBody: spec.extraBody ?? {},
      }));
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
