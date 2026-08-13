# The kitchen

A map of every route that runs on the server. Kept current as routes get added,
because a backend you cannot describe is a backend you cannot reason about.

A backend does three jobs, and only three:

1. **It keeps secrets.** Anything you would not write on a billboard.
2. **It does the real work.** Calling the AI, saving data, taking payment.
3. **It enforces the rules.** The bouncer cannot stand out in the street.

## Routes

### `POST /api/generate`

`app/api/generate/route.ts`

| | |
|---|---|
| What it does | Takes a destination and a number of days, asks Gemini for a day-by-day itinerary, streams it back as it is written. |
| Secrets it touches | `GEMINI_API_KEY`. Read from the environment, never sent to the browser. |
| Rules it enforces | You must be signed in and not suspended. Destination must not be empty and must be under 60 characters. Days must be a whole number from 1 to 7. Input is checked before the key is read, so a bad request gets a 400 rather than a misleading 500. |
| Answers with | A stream of newline-delimited JSON, each line either `{"text"}` or `{"error"}`. Anything rejected before the stream starts answers in one piece instead: `400` on bad input, `401` when signed out, `403` when suspended, `500` if the server has no key, `502` or `504` if the AI fails. |

## The door

`proxy.ts` runs before any route and turns away anyone without a session, sends
suspended accounts to `/suspended`, and keeps non-admins out of `/admin`.

It is not the only check, on purpose. Next's docs describe this layer as suited
to optimistic checks and explicitly not a full authorization solution, so every
handler asks again with `requireViewer()` or `getViewer()` before doing work.
The door keeps people out of pages. The handlers keep them out of data. The day
someone edits a matcher pattern is the day you find out which of the two was
actually load bearing.

## What would change if this moved to Go or Python

Almost nothing that matters. The prompt, the validation rules, the shape of the
answer, and the decision about which model to call are the actual work, and they
translate line for line. What changes is plumbing: how the server boots, how a
request is read, how a response is written.

That is worth knowing before you ever need it. The job stays the same. Only the
kitchen changes.
