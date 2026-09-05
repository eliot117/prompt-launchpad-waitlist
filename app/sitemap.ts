import type { MetadataRoute } from "next";

const SITE_URL = "https://prompt-launchpad-waitlist.vercel.app";

/**
 * Only the landing page is listed. `/verify` and `/invite` are functional
 * routes (a token consumer and a redirect) with no content of their own, so
 * they are deliberately absent rather than listed and ignored.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
