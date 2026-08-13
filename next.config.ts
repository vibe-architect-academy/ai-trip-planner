import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Vercel Blob serves public files from a per-store subdomain. Without
        // this, next/image refuses to optimise them and every photo 400s.
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    // Modern formats first. A holiday photo straight off a phone is several
    // megabytes of JPEG; the same image as AVIF is a fraction of that, and the
    // browser that cannot read it silently gets the next one in the list.
    formats: ["image/avif", "image/webp"],
    // The widths actually used by the photo grid, so no larger variant is
    // generated and paid for than any layout can ask for.
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [128, 256, 384],
  },

  async headers() {
    return [
      {
        // Anything Next fingerprints with a content hash can be cached
        // permanently, because a change produces a different filename. This is
        // the single biggest win available and it is safe precisely because of
        // the hash.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*.(woff|woff2|ttf|otf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

/*
 * Sentry wraps the config to upload source maps at build time, which is what
 * turns a stack trace full of minified nonsense into one naming real files
 * and lines. Without it a production error report is close to unreadable.
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  // Nothing is uploaded without these, so a build with no Sentry account
  // still succeeds rather than failing on a missing token.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    // Delete the maps after they are uploaded, so Sentry can read them and
    // the browser cannot. Shipping them publicly hands anyone your source.
    deleteSourcemapsAfterUpload: true,
  },
});
