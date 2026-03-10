import type { MetadataRoute } from "next";

const isProduction =
  process.env.NEXT_PUBLIC_API_URL?.includes("trypillar.com") ||
  process.env.VERCEL_ENV === "production";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

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
          "/keys",
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
