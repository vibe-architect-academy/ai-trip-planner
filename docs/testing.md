# Testing

```
npm run test:e2e
```

## What you need first

**Clerk keys, at minimum.** Not a preference. Every page in this app renders
inside Clerk's provider and every request passes through its proxy, so without
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` the server answers
500 to everything and no test of any kind can run.

That is worth knowing rather than working around. An app whose auth is genuinely
load-bearing cannot be tested with auth removed, and a test suite that runs
against a version of the app with the bouncer taken off the door is testing a
different app.

## The three files

**`public.spec.ts`** needs no account. It is entirely API-level, and that is
deliberate: this is where the promises live. A page test proves the interface
does not show something. An API test proves the server does not send it, which
is the claim that matters, because anyone can call the API without the page.

It covers the ones that would be expensive to get wrong: the worker refusing
an unsigned job, the payment webhook refusing both an unsigned and a forged
event, a personal endpoint never carrying a shared-cache header, and the health
endpoint never claiming to be fine while answering an error.

**`pages.spec.ts`** renders pages, including a check that the home page does
not scroll sideways at 390px, which looks broken on a phone and is invisible
on a laptop.

**`isolation.spec.ts`** is the one this whole app exists to pass: user B cannot
open user A's trip. It needs two real accounts, so it is skipped unless
`E2E_USER_A_*` and `E2E_USER_B_*` are set.

It checks both the page and the API, on purpose. If it only opened the page, a
pass would prove the interface declined to render the trip, not that the server
declined to send it.

## Skipping, out loud

Tests that cannot run are skipped with a printed reason rather than deleted or
quietly passed. "6 skipped, needs Clerk keys" is a fact somebody can act on. A
suite that looks green because it did almost nothing is worse than a red one.
