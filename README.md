# AI Trip Planner

The reference app for [ArchVibe](https://archvibe.app). Describe a trip, upload
inspiration photos, an AI writes the day-by-day itinerary, share it with a
travel partner.

**Live:** https://demo.archvibe.app

## What this repo actually is

Not a polished open-source project with a tidy initial commit. It is the real
thing a student ends up with, built by taking the course from an empty folder,
one lesson at a time.

**The commit history is the syllabus.** Every lesson that changes code has
exactly one commit, tagged `lesson-01` through `lesson-34`, and the message
says which wall it closed.

Read any single lesson as a diff:

```
git diff lesson-06 lesson-07     # one page file became components
git diff lesson-10 lesson-11     # user A stopped being able to read user B's trip
```

Start at the bottom. `lesson-01` is one HTML file with an API key sitting in
the browser, which is roughly what a weekend of vibe coding produces.
Everything above it exists because that version broke in a new and interesting
way.

## The journey, in one table

| | The wall | What closed it |
|---|---|---|
| 01 | It works, and it is one file with a key in it | the first build |
| 02 | Breaking it was permanent | version control |
| 03 | The key was in the source | it moved out, and out of history |
| 04 | It looked like homework | Tailwind, WCAG AA, dark mode |
| 05 | The browser was doing the server's job | Next.js, key server-side |
| 06 | The backend was a black box | wrote down what it does |
| 07 | One file did everything | components |
| 08 | It failed silently | every path answers, and logs |
| 09 | It only ran on my laptop | Vercel, deploy on push |
| 10 | The server gave up on long trips | streaming |
| 11 | Anyone could read anyone's trip | Clerk, roles, ownership |
| 12 | Nothing survived a refresh | Neon Postgres |
| 13 | Photos had nowhere to live | Vercel Blob |
| 14 | Nobody could find or share it | metadata, OG, sitemap |
| 15 | It was built for a laptop | mobile first |
| 16 | It only spoke English | i18n, and localised dates |
| 17 | It was slow from far away | edge caching |
| 18 | Uploads waited on the AI | QStash background jobs |
| 19 | One user's upload hurt everyone | a paced queue, signed |
| 20 | "Can I share this" was a guess | a state machine |
| 21 | Every task paid top price | right-sized models, a fallback ladder, evals |
| 22 | Nothing was worth paying for | Stripe, limits enforced server-side |
| 23 | Sharing did not reach anybody | Resend, a real public link |
| 24 | Leaving was impossible | export and delete, for real |
| 25 | Breakage was discovered by users | Sentry, health checks |
| 26 | Nobody knew where people gave up | PostHog funnel |
| 27 | "Works on my machine" | Docker |
| 28 | One server | nginx, three instances |
| 29 | One provider | what a platform was doing for you |
| 30 | Restarts were manual | Kubernetes |
| 31 | Every change was a gamble | Playwright |
| 32 | Shipping meant hoping | CI on every push |
| 33 | One environment for everything | local, preview, production |
| 34 | | this table |

## The stack

Next.js on Vercel · Clerk · Neon Postgres · Vercel Blob · QStash · an AI ladder
(Cerebras, Gemini, DeepSeek) · Stripe (test mode) · Resend · Sentry · PostHog.

All free tiers. The whole thing costs roughly nothing to run at this size.

## Running it

```
cp .env.example .env.local     # then fill in what you have
npm install
npm run db:migrate
npm run dev
```

Clerk keys are the minimum. Every page renders inside its provider and every
request passes through its proxy, so without them the server answers 500 to
everything. Everything else degrades rather than breaking: no `GEMINI_API_KEY`
and generation is unavailable while the rest of the app works, no
`QSTASH_TOKEN` and photos stay on "processing".

`docker compose up` runs the app plus a real Postgres with no hosted account at
all.

## A note on which AI answers

The course teaches Gemini, and this repo still supports it. The live demo runs
**Cerebras** first, set by `AI_PROVIDER_ORDER` rather than by a code change.

The reason is worth stating plainly, because it is a trap anyone can walk into:
Gemini's free tier exists only on a Google Cloud project with **billing
disabled**. On an account that already pays Google for something else there is
no free tier at all, and every call is billed. A student following the course
usually has no billing enabled and gets exactly what the lesson describes.

Which provider answers is a fact about whose account is paying, not about how
the app should be built, so it lives in an environment variable. That is also
lesson 21 ceasing to be theoretical: the fallback ladder is not a hypothetical
about resilience, it is the reason this deployment runs at all. See `docs/ai.md`.

## A note on the payment provider

Lesson 22 teaches Creem first and Stripe as the alternative. This repo takes
the alternative, and the payments layer is a single file plus a webhook, which
is the lesson's actual point: a payment vendor is a swappable decision, not a
permanent marriage.

Stripe here is **test mode only**, enforced in code. `lib/billing/stripe.ts`
refuses to start with a key that is not `sk_test_`.

## What I would tell you about the code

The load-bearing ideas, if you only read a few files:

- **Ownership is in the query, never a check the caller remembers.** There is
  no `getTrip(id)` in `lib/db/trips.ts`, only `getTrip(id, userId)`. A function
  that *can* return someone else's data eventually will.
- **The server enforces; the UI is a courtesy.** Buttons hide when an action is
  unavailable. That stops an honest person doing the wrong thing and stops
  nobody else, so every rule is enforced again in the route.
- **Fail closed.** The queue worker and the payment webhook refuse anything
  they cannot verify, including when they are unconfigured.
- **Missing credentials degrade, they do not crash the build.** Enforced by CI,
  which builds with no secrets present.

## License

MIT. Take any of it. It is a teaching artifact rather than a product, so it has
no roadmap and no support, but issues pointing at a genuine bug are welcome,
because a bug here usually means a bug in a lesson.
