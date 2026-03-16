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

  // Disable server-side image optimization — images are pre-optimized at build time.
  // This avoids CPU-intensive Sharp/squoosh work blocking the single-threaded Node server.
  images: {
    unoptimized: true,
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
    // In development, avoid custom immutable caching headers so HMR and
    // hydration always use fresh client bundles.
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        // Versioned static assets (opt-in): place files under
        // /public/marketing/versioned and bump filename/path when content changes.
        // These are safe to cache aggressively.
        source: "/marketing/versioned/:path*\\.(ico|jpg|jpeg|png|gif|webp|svg|woff|woff2|otf|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Static assets in public folder (images, fonts)
        // Keep this short-lived so updates roll out quickly.
        source: "/:path*\\.(ico|jpg|jpeg|png|gif|webp|svg|woff|woff2|otf|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Next.js static files (JS, CSS bundles)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // SEO metadata files - cache for 1 hour
        source: "/(robots.txt|sitemap.xml|llms.txt)",
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
      // Clean up legacy /index.html URLs (avoid soft-404 + noindex pages)
      {
        source: "/blog/index.html",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/pricing/index.html",
        destination: "/pricing",
        permanent: true,
      },
      {
        source: "/terms/index.html",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/agent",
        destination: "/assistant",
        permanent: true,
      },
      {
        source: "/agent/",
        destination: "/assistant",
        permanent: true,
      },
      // Docs index redirect
      {
        source: "/docs",
        destination: "/docs/get-started/what-is-pillar",
        permanent: false,
      },
      // Overview section
      {
        source: "/docs/getting-started/introduction",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      {
        source: "/docs/getting-started/quick-start",
        destination: "/docs/get-started/quickstart",
        permanent: true,
      },
      // Old quickstart paths -> new quickstart (with framework hint)
      {
        source: "/docs/quickstarts/nextjs",
        destination: "/docs/get-started/quickstart?framework=react",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/vite",
        destination: "/docs/get-started/quickstart?framework=react",
        permanent: true,
      },
      // React section -> Reference
      {
        source: "/docs/react/installation",
        destination: "/docs/get-started/quickstart",
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
        destination: "/docs/get-started/quickstart",
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
      // Configuration section -> Guides (bare path catch-all)
      {
        source: "/docs/configuration",
        destination: "/docs/guides/panel",
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
        source: "/docs/knowledge",
        destination: "/docs/knowledge-base/overview",
        permanent: true,
      },
      {
        source: "/docs/knowledge/:path*",
        destination: "/docs/knowledge-base/overview",
        permanent: true,
      },
      {
        source: "/docs/data-sources/:path*",
        destination: "/docs/knowledge-base/overview",
        permanent: true,
      },
      // Old overview section → Get Started
      {
        source: "/docs/overview",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      {
        source: "/docs/overview/introduction",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      {
        source: "/docs/overview/how-it-works",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      // Old quickstarts section → unified quickstart (with framework query param)
      {
        source: "/docs/quickstarts",
        destination: "/docs/get-started/quickstart",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/react",
        destination: "/docs/get-started/quickstart?framework=react",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/vue",
        destination: "/docs/get-started/quickstart?framework=vue",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/angular",
        destination: "/docs/get-started/quickstart?framework=angular",
        permanent: true,
      },
      {
        source: "/docs/quickstarts/vanilla",
        destination: "/docs/get-started/quickstart?framework=vanilla",
        permanent: true,
      },
      // Old features section → Core Concepts
      {
        source: "/docs/features",
        destination: "/docs/core-concepts/tools",
        permanent: true,
      },
      {
        source: "/docs/features/chat",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      {
        source: "/docs/features/tools",
        destination: "/docs/core-concepts/tools",
        permanent: true,
      },
      {
        source: "/docs/features/knowledge-base",
        destination: "/docs/core-concepts/knowledge-base",
        permanent: true,
      },
      {
        source: "/docs/features/custom-cards",
        destination: "/docs/core-concepts/inline-ui",
        permanent: true,
      },
      {
        source: "/docs/core-concepts/custom-cards",
        destination: "/docs/core-concepts/inline-ui",
        permanent: true,
      },
      {
        source: "/docs/guides/custom-cards",
        destination: "/docs/guides/inline-ui",
        permanent: true,
      },
      {
        source: "/docs/features/human-escalation",
        destination: "/docs/core-concepts/human-escalation",
        permanent: true,
      },
      // Old getting-started catch-all
      {
        source: "/docs/getting-started",
        destination: "/docs/get-started/what-is-pillar",
        permanent: true,
      },
      // Actions -> Tools rename
      {
        source: "/docs/features/actions",
        destination: "/docs/core-concepts/tools",
        permanent: true,
      },
      {
        source: "/docs/guides/actions",
        destination: "/docs/guides/tools",
        permanent: true,
      },
      {
        source: "/docs/guides/actions-sync",
        destination: "/docs/guides/tools-sync",
        permanent: true,
      },
      {
        source: "/docs/reference/action-types",
        destination: "/docs/reference/tool-types",
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
