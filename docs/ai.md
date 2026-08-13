# Which AI answers, and why

## The ladder

`lib/ai/provider.ts` holds an ordered list of providers. A request tries them in
turn, skipping any without a key, and the first one that answers wins. Only the
call that *opens* the stream falls down the ladder: once text is arriving, a
failure keeps what arrived, because switching providers mid-itinerary would
splice two different trips together.

Three are wired up:

| | Dialect | Free tier |
|---|---|---|
| Gemini | its own | yes, **only on a project with billing disabled** |
| Cerebras | OpenAI-compatible | 1M tokens/day, ~60–100k/min, no card |
| DeepSeek | OpenAI-compatible | no, but cheap enough to be the floor |

Two dialects, not three clients. Cerebras and DeepSeek both speak the OpenAI
chat-completions shape, so one function covers them. Writing a second
near-identical client is how a fix lands in one and not the other.

## The order is configuration, not code

```
AI_PROVIDER_ORDER=cerebras,deepseek
```

Unset, the order is `gemini, cerebras, deepseek`, which matches what the course
teaches. Naming one provider promotes it and leaves the others behind it as
fallbacks, so setting this cannot silently switch off something you are paying
for.

**Why this is configuration.** Gemini's free tier only exists on a Google Cloud
project with billing disabled. On an account that already pays Google for
something else, there is no free tier at all and every call is billed. That is a
fact about whose account is paying, not about how the app should be built, so it
belongs in an environment variable rather than in a rewrite.

The live demo therefore runs Cerebras first. The course still teaches Gemini,
and a student following it will usually have a Google account with no billing
enabled, where the free tier works exactly as described.

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
