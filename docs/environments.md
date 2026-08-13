# Sacred ground

Three environments, and one rule that matters more than the rest.

| | Where | Database | Money | Who sees it |
|---|---|---|---|---|
| Local | your machine | Docker Postgres, or a Neon branch | Stripe test | you |
| Preview | Vercel, per branch | a Neon branch | Stripe test | anyone with the link |
| Production | Vercel, `main` | the Neon database | Stripe test, because this app takes no real money | everyone |

## The rule

**Production data never comes down, and non-production data never goes up.**

Copying the production database to your laptop to debug something is the most
tempting shortcut in software and the one most likely to end badly. It puts
real people's data on a machine with no access control, no audit, and no
backup policy, and it stays there long after you have forgotten the bug. If you
need realistic data, generate it.

## Why preview environments earn their keep

Every branch gets a running copy at its own URL. That changes what review is:
instead of reading a diff and imagining the result, somebody opens the thing
and uses it. Most of what gets caught this way is not wrong code, it is a
decision that reads fine and feels wrong.

Preview branches also get their own database branch, so a migration can be
tried against a real copy of the schema without threatening the real data.

## Secrets

Each environment has its own set. The same variable names, different values,
and nothing shared across the boundary. That is the whole reason lesson 3
insisted the values live outside the code: the code is identical everywhere,
and only the configuration changes.

Rotating a leaked key is then a dashboard change and a redeploy, rather than
a hunt through the source for everywhere it was written down.

## What runs before anything ships

`.github/workflows/ci.yml`, on every push and pull request: typecheck, build
with no secrets present, a grep of the built client bundle for anything
credential-shaped, then the end-to-end suite.

That third one deserves its place. A `NEXT_PUBLIC_` prefix on the wrong
variable ships a key to every visitor and looks exactly like working code in
review. A machine notices; a reviewer at 6pm on a Friday does not.
