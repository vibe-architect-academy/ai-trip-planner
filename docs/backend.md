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
| What it does | Takes a destination and a number of days, asks Gemini for a day-by-day itinerary, returns it. |
| Secrets it touches | `GEMINI_API_KEY`. Read from the environment, never sent to the browser. |
| Rules it enforces | Destination must not be empty. Days must be a whole number from 1 to 7. Both are checked before the key is even read, so a bad request gets a 400 rather than a misleading 500. |
| Answers with | `200` and `{ destination, days, itinerary }`, `400` on bad input, `500` if the server has no key, `502` if the AI call fails. |

## What would change if this moved to Go or Python

Almost nothing that matters. The prompt, the validation rules, the shape of the
answer, and the decision about which model to call are the actual work, and they
translate line for line. What changes is plumbing: how the server boots, how a
request is read, how a response is written.

That is worth knowing before you ever need it. The job stays the same. Only the
kitchen changes.
