import type { MetadataRoute } from "next";

const SITE_URL = "https://prompt-launchpad-waitlist.vercel.app";

/**
 * List public editorial pages only. Functional and private routes stay out.
 * This sitemap becomes public only with an explicitly approved deployment.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      // Omit lastmod until a substantive content-update date is maintained.
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
