import type { MetadataRoute } from "next";
import { getAllBlogPosts } from "@/lib/blog-content";

/**
 * Dynamic sitemap generation for SEO.
 *
 * Includes:
 * - Marketing pages (/, /assistant)
 * - Blog index and individual posts
 * - Documentation pages
 * - LLM discoverability pages
 *
 * Next.js automatically serves this at /sitemap.xml
 */

/** All canonical documentation page paths (excluding redirect sources). */
const DOC_PAGES = [
  // Overview
  "overview/introduction",
  "overview/how-it-works",
  // Quickstarts
  "quickstarts/react",
  "quickstarts/vanilla",
  // Features
  "features/tools",
  "features/chat",
  "features/custom-cards",
  "features/human-escalation",
  "features/knowledge-base",
  // Guides
  "guides/tools",
  "guides/tools-sync",
  "guides/agent-guidance",
  "guides/context",
  "guides/custom-cards",
  "guides/edge-trigger",
  "guides/human-escalation",
  "guides/panel",
  "guides/testing",
  "guides/text-selection",
  "guides/theme",
  // Knowledge Base
  "knowledge-base/overview",
  "knowledge-base/website",
  "knowledge-base/files",
  "knowledge-base/cloud-storage",
  "knowledge-base/snippets",
  // Reference
  "reference/core",
  "reference/react",
  "reference/tool-types",
  "reference/events",
  "reference/theme-options",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://trypillar.com";

  // Get all blog posts for dynamic sitemap entries
  const blogPosts = getAllBlogPosts();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/assistant`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/demos`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-llms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.frontmatter.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const docPages: MetadataRoute.Sitemap = DOC_PAGES.map((page) => ({
    url: `${baseUrl}/docs/${page}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const demoPages: MetadataRoute.Sitemap = [
    "banking",
    "crm",
    "analytics",
    "pm",
    "hr",
    "grafana",
  ].map((slug) => ({
    url: `${baseUrl}/demos/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...docPages, ...demoPages];
}
