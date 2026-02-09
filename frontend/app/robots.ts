import type { MetadataRoute } from "next";

/**
 * Robots.txt configuration for SEO.
 *
 * Allows all crawlers to index the site and points to the sitemap.
 * Next.js automatically serves this at /robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/login",
          "/signup",
          "/logout",
          "/accept-invite",
        ],
      },
    ],
    sitemap: "https://trypillar.com/sitemap.xml",
  };
}
