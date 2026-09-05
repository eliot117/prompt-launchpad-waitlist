import type { MetadataRoute } from "next";

const SITE_URL = "https://prompt-launchpad-waitlist.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /verify carries single-use signup tokens in the query string — there is
      // nothing to index and a crawler hitting one would burn it.
      disallow: "/verify",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
