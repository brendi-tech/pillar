import fs from "fs";
import type { NextConfig } from "next";
import path from "path";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

// Load env vars from monorepo root .env.local (shared with Django backend)
// Using manual dotenv parsing since @next/env doesn't load from parent dirs properly
const monorepoRoot = path.resolve(process.cwd(), "..");
const envLocalPath = path.join(monorepoRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Only set if not already set (don't override)
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Configure MDX with remark/rehype plugins
const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
});

const nextConfig: NextConfig = {
  // Output standalone build for Docker deployment
  output: "standalone",

  // Enable MDX pages
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  // Image optimization configuration
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560],
    formats: ["image/avif", "image/webp"],
  },

  // Turbopack configuration (for next dev --turbopack)
  // Mirrors the webpack aliases below for SDK packages
  // Note: Turbopack requires package-relative paths, not absolute paths
  experimental: {
    turbo: {
      resolveAlias: {
        "@pillar-ai/sdk": "@pillar-ai/sdk/dist/pillar.esm.js",
        "@pillar-ai/react": "@pillar-ai/react/dist/index.esm.js",
      },
    },
  },

  // Cache headers for static assets
  async headers() {
    return [
      {
        // Static assets in public folder (images, fonts)
        source: "/:path*\\.(ico|jpg|jpeg|png|gif|webp|svg|woff|woff2|otf|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js static files (JS, CSS bundles)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // SEO metadata files - cache for 1 hour
        source: "/(robots.txt|sitemap.xml)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Health check - prevent CDN caching
        source: "/api/health",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // Redirects from old docs structure to new
  async redirects() {
    return [
      // Docs index redirect
      {
        source: "/docs",
        destination: "/docs/overview/introduction",
        permanent: false,
      },
      // Overview section
      {
        source: "/docs/getting-started/introduction",
        destination: "/docs/overview/introduction",
        permanent: true,
      },
      {
        source: "/docs/getting-started/quick-start",
        destination: "/docs/quickstarts/react",
        permanent: true,
      },
      // Old quickstart paths -> new React quickstart
      {
        source: "/docs/quickstarts/nextjs",
        destination: "/docs/quickstarts/react",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/vite",
        destination: "/docs/quickstarts/react",
        permanent: true,
      },
      // React section -> Reference
      {
        source: "/docs/react/installation",
        destination: "/docs/quickstarts/react",
        permanent: true,
      },
      {
        source: "/docs/react/provider",
        destination: "/docs/reference/react",
        permanent: true,
      },
      {
        source: "/docs/react/hooks",
        destination: "/docs/reference/react",
        permanent: true,
      },
      // Vanilla section -> Quickstarts
      {
        source: "/docs/vanilla/installation",
        destination: "/docs/quickstarts/vanilla",
        permanent: true,
      },
      // Configuration section -> Guides
      {
        source: "/docs/configuration/panel",
        destination: "/docs/guides/panel",
        permanent: true,
      },
      {
        source: "/docs/configuration/edge-trigger",
        destination: "/docs/guides/edge-trigger",
        permanent: true,
      },
      {
        source: "/docs/configuration/theme",
        destination: "/docs/guides/theme",
        permanent: true,
      },
      // Legacy knowledge/data-sources redirects -> Knowledge Base
      {
        source: "/docs/knowledge/gcs-setup",
        destination: "/docs/knowledge-base/cloud-storage",
        permanent: true,
      },
      {
        source: "/docs/knowledge/s3-setup",
        destination: "/docs/knowledge-base/cloud-storage",
        permanent: true,
      },
      {
        source: "/docs/data-sources/:path*",
        destination: "/docs/knowledge-base/overview",
        permanent: true,
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Resolve SDK packages to their pre-built ESM bundles
    // This prevents Next.js from re-transpiling the Preact JSX with React's runtime
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        // Point to the ESM bundles from npm packages
        "@pillar-ai/sdk$": path.resolve(
          __dirname,
          "node_modules/@pillar-ai/sdk/dist/pillar.esm.js"
        ),
        "@pillar-ai/react$": path.resolve(
          __dirname,
          "node_modules/@pillar-ai/react/dist/index.esm.js"
        ),
      };
    }

    // Allow importing code examples as raw strings
    // Examples use .txt extension to avoid TypeScript compilation
    config.module.rules.push({
      test: /examples\/.*\.txt$/,
      type: "asset/source",
    });

    return config;
  },
};

export default withMDX(nextConfig);
