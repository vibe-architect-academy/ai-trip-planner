# Which AI answers, and why

## The ladder

`lib/ai/provider.ts` holds an ordered list of providers. A request tries them in
turn, skipping any without a key, and the first one that answers wins. Only the
call that *opens* the stream falls down the ladder: once text is arriving, a
failure keeps what arrived, because switching providers mid-itinerary would
splice two different trips together.

A rung is a **model**, not a provider, because rate limits are per model. Groq
gives each its own bucket, so falling from one model to the next multiplies the
free capacity without involving a second vendor.

The live ladder, all on Groq:

| Model | Tokens/min | Tokens/day | Roughly |
|---|---|---|---|
| `openai/gpt-oss-120b` | 8K | 200K | ~80 itineraries |
| `openai/gpt-oss-20b` | 8K | 200K | ~80 more |
| `groq/compound` | 70K | **no cap** | 250/day, its own request limit |

About 410 free itineraries a day from one account. Quality first, headroom
last: the flagship writes the best plan and runs out soonest; compound is
slower but never hits a daily token wall.

Gemini, Cerebras and DeepSeek stay configured as further rungs, reached only
if a key exists for them.

Two dialects, not three clients. Cerebras and DeepSeek both speak the OpenAI
chat-completions shape, so one function covers them. Writing a second
near-identical client is how a fix lands in one and not the other.

## The order is configuration, not code

```
AI_PROVIDER_ORDER=groq
```

Unset, the order is `gemini, groq, cerebras, deepseek`, which starts with what
the course teaches. Naming one provider promotes it and leaves the others behind it as
fallbacks, so setting this cannot silently switch off something you are paying
for.

**Why this is configuration.** Gemini's free tier only exists on a Google Cloud
project with billing disabled. On an account that already pays Google for
something else, there is no free tier at all and every call is billed. That is a
fact about whose account is paying, not about how the app should be built, so it
belongs in an environment variable rather than in a rewrite.

The live demo therefore runs Groq. The course still teaches Gemini, and a
student following it usually has a Google account with no billing enabled,
where the free tier works exactly as described.

Cerebras is a sharper version of the same lesson: its limits page advertises
generous quotas, and with a zero balance every call returns 402. Those numbers
describe what you get after buying credits. Test a provider with one real
request before believing any pricing page, including this table.

This is also lesson 21 stopping being a description. The ladder is not a
hypothetical about resilience; it is the reason this deployment runs at all.

## Right-sizing

Writing the itinerary is the product, so it gets the better model. Sorting a
request into a trip type and writing a one-line summary run on every request and
return a word and a sentence, so they get the cheap one and a hard output
ceiling. Paying itinerary prices for a one-word answer is most of a bill nobody
can explain later.

## Before changing a model or a prompt

```
npm run evals
```

Eight sample trips, checked for structure and failing the run if it breaks.
Switching a model to save money is easy; noticing that it quietly made the
itineraries worse is not, because nothing errors. The app keeps working and the
output is simply less good, and you find out from a review months later.

## Models that did not make the ladder

Both were tried against the real API and rejected:

- **`qwen/qwen3.6-27b`** ignores the heading format completely. It emits the
  bold labels but no `### Day` headings, so the parser finds zero days.
- **`allam-2-7b`** is the more interesting failure, and the more dangerous one.
  It formats perfectly and has by far the largest daily budget, but it invents
  facts: it placed Kabuki-za in Kyoto when it is in Tokyo, offered "the
  picturesque Japanese Garden" as though that were a place, and put Kikunoi in
  the wrong district.

The second is worth remembering. A model that returns the wrong shape fails
loudly and gets caught by `checkItinerary`. A model that returns the right
shape with wrong content passes every automated check you have, and the only
thing standing between it and your users is somebody reading the output.
