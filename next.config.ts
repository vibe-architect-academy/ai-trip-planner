import type { NextConfig } from "next";

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

export default nextConfig;
