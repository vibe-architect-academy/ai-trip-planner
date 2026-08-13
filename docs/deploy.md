# Putting it on the internet

The app runs on Vercel. Deploys are not a command you run; they happen because
you pushed. Push to `main` and the live site rebuilds itself.

## One time

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), import the repo. Vercel recognises
   Next.js on its own, so every build setting can be left alone.
3. Add the environment variables below under **Settings, Environment
   variables**, for Production and Preview both.
4. Deploy.

## Environment variables

Everything listed in `.env.example` has to exist in Vercel too. Your `.env.local`
is on your laptop and gitignored, which is the point of it, so the server has
never seen it.

| Name | Why it exists |
|---|---|
| `GEMINI_API_KEY` | Read only inside `app/api/generate/route.ts`, which runs on the server. |

None of these carry a `NEXT_PUBLIC_` prefix, and that is deliberate. That prefix
bakes a value into the JavaScript the browser downloads, which for a key means
publishing it. If you ever need to check, build and search: nothing under
`.next/static` should ever contain a secret.

## What happens on every push

```
push to main  ->  Vercel builds  ->  live in about a minute
push a branch ->  Vercel builds  ->  its own preview URL
```

Preview URLs are the useful half. Every branch gets a real, shareable, running
copy of the app, which is a far better way to check something works than
describing it to someone.

## When a deploy fails

The build log is the first place to look, and it is usually one of three things:
a variable set locally but never added in Vercel, a dependency that was
installed but never saved to `package.json`, or a TypeScript error that
`next dev` was lenient about and `next build` is not. Run `npm run build`
locally first and most of these never reach Vercel at all.
