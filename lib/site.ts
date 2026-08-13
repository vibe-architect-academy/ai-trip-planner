/**
 * Where this app thinks it lives.
 *
 * Absolute URLs are not optional for Open Graph. A relative og:image is
 * ignored by every scraper, so a preview that looks fine locally shows nothing
 * at all once it is shared. Vercel provides VERCEL_PROJECT_PRODUCTION_URL on
 * its own, so production works without anyone remembering to set anything.
 */

export const siteUrl: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const siteName = "AI Trip Planner";
export const siteDescription = "Describe the trip. Get a real plan, day by day.";
