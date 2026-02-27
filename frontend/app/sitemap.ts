import type { MetadataRoute } from "next";
import * as fs from "fs";
import * as path from "path";
import { getAllBlogPosts } from "@/lib/blog-content";

const BASE_URL = "https://trypillar.com";
const APP_DIR = path.join(process.cwd(), "app");
const DATES_FILE = path.join(process.cwd(), "generated/sitemap-dates.json");

type GitDates = Record<string, string>;

function loadGitDates(): GitDates {
  try {
    return JSON.parse(fs.readFileSync(DATES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Routes that should never appear in the sitemap.
 * Admin routes (served on admin.* subdomain), auth pages, and internal paths.
 */
const EXCLUDED_PREFIXES = [
  // Admin routes (served on admin.* subdomain)
  "/actions",
  "/analytics",
  "/billing",
  "/configure",
  "/content",
  "/knowledge",
  "/setup",
  "/team",
  "/tools",
  // Auth
  "/login",
  "/signup",
  "/logout",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/oauth-callback",
  // Internal
  "/marketing",
  "/api",
  // Legacy redirect sources (redirects configured in next.config.ts)
  "/docs/getting-started",
  "/docs/react",
  "/docs/vanilla",
];

const EXCLUDED_EXACT = new Set(["/docs", "/signup-beta"]);

function isExcluded(urlPath: string): boolean {
  if (EXCLUDED_EXACT.has(urlPath)) return true;
  return EXCLUDED_PREFIXES.some(
    (prefix) => urlPath === prefix || urlPath.startsWith(prefix + "/")
  );
}

/**
 * Determine priority and changeFrequency based on URL path.
 */
function getMetadata(urlPath: string): {
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
} {
  if (urlPath === "/") return { priority: 1, changeFrequency: "weekly" };
  if (urlPath === "/blog") return { priority: 0.9, changeFrequency: "weekly" };
  if (urlPath.startsWith("/blog/"))
    return { priority: 0.7, changeFrequency: "monthly" };
  if (urlPath === "/resources/agent-score")
    return { priority: 0.8, changeFrequency: "weekly" };
  if (urlPath === "/resources/build-vs-buy")
    return { priority: 0.8, changeFrequency: "monthly" };
  if (urlPath === "/demos") return { priority: 0.7, changeFrequency: "weekly" };
  if (urlPath.startsWith("/demos/"))
    return { priority: 0.6, changeFrequency: "monthly" };
  if (urlPath === "/pricing")
    return { priority: 0.7, changeFrequency: "monthly" };
  // Docs: overview/quickstarts are discovery pages, guides/reference serve existing users
  if (urlPath.startsWith("/docs/overview/") || urlPath.startsWith("/docs/quickstarts/") || urlPath.startsWith("/docs/features/"))
    return { priority: 0.6, changeFrequency: "monthly" };
  if (urlPath.startsWith("/docs/"))
    return { priority: 0.5, changeFrequency: "monthly" };
  if (urlPath === "/for-llms")
    return { priority: 0.5, changeFrequency: "monthly" };
  if (urlPath === "/terms" || urlPath === "/privacy")
    return { priority: 0.3, changeFrequency: "yearly" };
  return { priority: 0.5, changeFrequency: "monthly" };
}

/**
 * Strip Next.js route groups from path segments.
 * e.g. (admin)/billing -> billing
 */
function stripRouteGroups(p: string): string {
  return p.replace(/\([^)]+\)\//g, "").replace(/\/\([^)]+\)/g, "");
}

/**
 * Recursively find all page files and return their public URL paths.
 * Skips dynamic segments like [slug] since those are handled separately.
 */
function discoverStaticRoutes(dir: string, basePath = ""): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Skip dynamic route segments — they need explicit enumeration
      if (entry.name.startsWith("[")) continue;
      const segment = entry.name;
      results.push(...discoverStaticRoutes(path.join(dir, segment), `${basePath}/${segment}`));
    } else if (/^page\.(tsx|ts|jsx|js|mdx|md)$/.test(entry.name)) {
      const urlPath = stripRouteGroups(basePath || "/");
      results.push(urlPath || "/");
    }
  }

  return results;
}

/**
 * Map marketing rewrite paths: middleware serves /marketing/foo at /foo.
 */
function applyMarketingRewrite(urlPath: string): string | null {
  if (urlPath === "/marketing") return "/";
  if (urlPath.startsWith("/marketing/")) return urlPath.replace(/^\/marketing/, "");
  return urlPath;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const gitDates = loadGitDates();

  // 1. Auto-discover static routes from the filesystem
  const discoveredPaths = discoverStaticRoutes(APP_DIR);
  const publicPaths = discoveredPaths
    .map(applyMarketingRewrite)
    .filter((p): p is string => p !== null)
    .filter((p) => !isExcluded(p));

  // 2. Enumerate dynamic demo routes
  //    (demos use /marketing/demos/[demo]/page.tsx for most demos)
  const demosDir = path.join(APP_DIR, "marketing/demos");
  const demoSlugs: string[] = [];
  if (fs.existsSync(demosDir)) {
    for (const entry of fs.readdirSync(demosDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("[")) {
        // Read generateStaticParams or discover from the git-dates manifest
        for (const key of Object.keys(gitDates)) {
          const match = key.match(/^\/demos\/([^/]+)$/);
          if (match && match[1] !== "[demo]") {
            demoSlugs.push(match[1]);
          }
        }
      }
    }
  }
  const demoPaths = demoSlugs.map((slug) => `/demos/${slug}`);

  // 3. Blog posts from content directory
  const blogPosts = getAllBlogPosts();
  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: gitDates[`/blog/${post.slug}`]
      ? new Date(gitDates[`/blog/${post.slug}`])
      : new Date(post.frontmatter.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // 4. Build sitemap entries for discovered + demo routes
  const allPaths = [...new Set([...publicPaths, ...demoPaths])];
  const pageEntries: MetadataRoute.Sitemap = allPaths
    .filter((p) => !p.startsWith("/blog/"))
    .map((urlPath) => {
      const { priority, changeFrequency } = getMetadata(urlPath);
      const lastModified = gitDates[urlPath]
        ? new Date(gitDates[urlPath])
        : undefined;

      return {
        url: `${BASE_URL}${urlPath === "/" ? "" : urlPath}`,
        ...(lastModified && { lastModified }),
        changeFrequency,
        priority,
      };
    });

  return [...pageEntries, ...blogEntries];
}
