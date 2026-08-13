import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // None of these are useful in an index, and two of them are private.
      // A crawler that follows /trips gets a sign-in page for its trouble,
      // which wastes its time and tells it nothing.
      disallow: ["/api/", "/admin", "/trips", "/sign-in", "/sign-up", "/suspended"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
