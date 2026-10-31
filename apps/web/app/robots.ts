import type { MetadataRoute } from "next";
import { absoluteUrl, BASE_PATH } from "@/lib/site";

export const dynamic = "force-static";

/**
 * robots.txt paths are resolved from the host root, not from the directory the
 * file sits in. On a GitHub Pages project site the app lives under a subpath,
 * so the base path has to be part of every rule.
 */
const dashboard = `${BASE_PATH}/dashboard`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The dashboard is an application surface, not a page for a search index.
        disallow: [dashboard, `${dashboard}/`],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
