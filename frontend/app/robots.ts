import type { MetadataRoute } from "next";

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
          "/forgot-password",
          "/reset-password",
          "/onboarding",
          "/oauth-callback",
          "/api-keys",
          "/actions",
          "/analytics",
          "/billing",
          "/configure",
          "/content",
          "/knowledge",
          "/setup",
          "/team",
          "/tools",
        ],
      },
    ],
    sitemap: [
      "https://trypillar.com/sitemap.xml",
      "https://trypillar.com/video-sitemap.xml",
    ],
  };
}
