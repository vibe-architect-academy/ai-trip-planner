import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Only pages a stranger can actually open.
 *
 * Every trip is private right now, so there is nothing else to list. When
 * sharing arrives this is where public trips get added, and the reason it is
 * a function rather than a static file is so that happens without anyone
 * remembering to regenerate anything.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
