# AI Trip Planner

The reference app for [ArchVibe](https://archvibe.app). Describe a trip, upload inspiration photos, an AI writes the day-by-day itinerary, share it with a travel partner.

**Live:** https://demo.archvibe.app

## What this repo actually is

This is not a polished open-source product with a clean initial commit. It is the real thing a student ends up with, built by taking the course from an empty folder, one lesson at a time.

**The commit history is the syllabus.** Every lesson that changes code has exactly one commit, tagged `lesson-01` through `lesson-34`, and the message says which wall it closed:

```
lesson-11  User A can no longer read User B's trip
lesson-10  Stream it, or the server gives up at 10s
lesson-07  One 900-line page became components
lesson-03  Took the API key out of the browser
lesson-01  It works. It is also a single HTML file.
```

So you can read the diff for any single lesson:

```
git diff lesson-06 lesson-07
```

Start at the bottom. `lesson-01` is one HTML file with an API key sitting in the browser, which is roughly what a weekend of vibe coding produces. Everything above it exists because that version broke in a new and interesting way.

## Status

Being built in public, lesson by lesson. Tags land as each lesson is completed.

| Tier | Lessons | Status |
|---|---|---|
| Ship It | 1 to 13 | in progress |
| Discovery | 14 to 17 | not started |
| Sell It | 18 to 26 | not started |
| Scale It | 27 to 34 | not started |

## What's in the box

Filled in as it gets built. The target stack is the one the course teaches: Next.js on Vercel, Clerk for auth, Neon for Postgres, Vercel Blob for files, QStash for background jobs, Stripe for payments, Resend for email, Sentry and PostHog for knowing what broke and what worked.

## A note on the code

The course teaches you to direct an AI builder rather than to write code by hand, so that is how this was built. The point is not that the code is beautiful. The point is that it works, that it survives a second user, and that you can see exactly which decision produced which line.

## License

MIT. Take any of it. It is a teaching artifact, not a product, so it has no roadmap and no support, but issues that point out a genuine bug are welcome because a bug here usually means a bug in a lesson.
