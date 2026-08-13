# The app, packaged so it runs the same everywhere.
#
# Vercel does not need this. It is here because "works on my machine" stops
# being funny the first time it is true, and because a container is what any
# other host will ask you for.
#
# Multi-stage on purpose: the final image carries the built app and nothing
# else. No compilers, no dev dependencies, no source. Smaller to ship, and a
# far smaller thing for anyone to find a hole in.

FROM node:24-alpine AS deps
WORKDIR /app
# Only the manifests first. Docker caches this layer, so a change to your code
# does not reinstall every dependency, which is the difference between a
# ten second rebuild and a three minute one.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next reads env at build time for anything NEXT_PUBLIC_. Real secrets are not
# baked in here; they arrive at run time.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# A user that is not root. If something does get in, it arrives as somebody
# with no permission to do anything interesting.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` in next.config.ts produces exactly the files needed to
# run, with its own minimal node_modules. Copying the whole tree instead would
# roughly triple the image for no benefit.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The health endpoint from lesson 25, doing a second job. An orchestrator can
# now tell the difference between "the process is alive" and "the app works".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
