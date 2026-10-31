import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * lastModified is the build time, not a constant. Crawlers use it to decide
 * what to re-fetch; a frozen date makes the signal worthless and eventually
 * untrue.
 */
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: BUILT_AT,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
