/**
 * Docs Navigation Configuration
 *
 * Static navigation structure for the SDK documentation.
 * Used by sidebar and prev/next navigation.
 *
 * The Reference section is auto-generated from the reference manifest
 * produced by scripts/generate-api-docs.ts.
 */

import referenceManifest from '@/generated/reference-manifest.json';

export interface NavItem {
  title: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  slug: string;
  items: NavItem[];
  /** Optional sub-groups within the section (used by Reference) */
  groups?: NavGroup[];
}

/**
 * Documentation navigation structure
 *
 * Follows the Hatchet-style progression:
 * - Get Started: What is Pillar? + Quickstart
 * - Core Concepts: Brief overviews of each concept
 * - Guides: Task-oriented how-to documentation
 * - Knowledge Base: Content sources and configuration
 * - Reference: API specifications and type definitions
 */
export const docsNavigation: NavSection[] = [
  {
    title: "Get Started",
    slug: "get-started",
    items: [
      { title: "What is Pillar?", href: "/docs/get-started/what-is-pillar" },
      { title: "Quickstart", href: "/docs/get-started/quickstart" },
      { title: "CLI Setup", href: "/docs/get-started/cli-setup" },
    ],
  },
  {
    title: "Core Concepts",
    slug: "core-concepts",
    items: [
      { title: "Tools", href: "/docs/core-concepts/tools" },
      { title: "Knowledge Base", href: "/docs/core-concepts/knowledge-base" },
      { title: "Human Escalation", href: "/docs/core-concepts/human-escalation" },
    ],
  },
  {
    title: "Agents",
    slug: "agents",
    items: [
      { title: "Overview", href: "/docs/agents/overview" },
      { title: "Web Widget", href: "/docs/agents/web-widget" },
      { title: "Slack", href: "/docs/agents/slack" },
      { title: "Discord", href: "/docs/agents/discord" },
      { title: "API", href: "/docs/agents/api" },
      { title: "MCP Server", href: "/docs/agents/mcp-server" },
    ],
  },
  {
    title: "Guides",
    slug: "guides",
    items: [
      { title: "Setting Up Tools", href: "/docs/guides/tools" },
      { title: "Syncing Tools", href: "/docs/guides/tools-sync" },
      { title: "Agent Guidance", href: "/docs/guides/agent-guidance" },
      { title: "Adding User Context", href: "/docs/guides/context" },
      { title: "Building Inline UI", href: "/docs/guides/inline-ui" },
      { title: "Customizing the Panel", href: "/docs/guides/panel" },
      { title: "Theming & Branding", href: "/docs/guides/theme" },
      { title: "Text Selection Helper", href: "/docs/guides/text-selection" },
      { title: "Edge Trigger", href: "/docs/guides/edge-trigger" },
      { title: "Human Escalation", href: "/docs/guides/human-escalation" },
      { title: "CLI Reference", href: "/docs/guides/cli" },
      { title: "Testing", href: "/docs/guides/testing" },
      { title: "Debug Mode", href: "/docs/guides/debug-mode" },
    ],
    groups: [
      {
        title: "Migration",
        items: [
          { title: "productKey → agentSlug", href: "/docs/guides/migration-agent-slug" },
        ],
      },
    ],
  },
  {
    title: "Knowledge Base",
    slug: "knowledge-base",
    items: [
      { title: "Overview", href: "/docs/knowledge-base/overview" },
      { title: "Website", href: "/docs/knowledge-base/website" },
      { title: "Files", href: "/docs/knowledge-base/files" },
      { title: "Cloud Storage", href: "/docs/knowledge-base/cloud-storage" },
      { title: "Snippets", href: "/docs/knowledge-base/snippets" },
    ],
  },
  {
    title: "Server SDKs",
    slug: "server-sdks",
    items: [
      { title: "Overview", href: "/docs/server-sdks/overview" },
      { title: "Quickstart", href: "/docs/server-sdks/quickstart" },
      { title: "Defining Tools", href: "/docs/server-sdks/defining-tools" },
      { title: "Framework Integration", href: "/docs/server-sdks/frameworks" },
      { title: "Confirmation Flows", href: "/docs/server-sdks/confirmations" },
      { title: "Identity Linking", href: "/docs/server-sdks/identity-linking" },
      { title: "Webhook Security", href: "/docs/server-sdks/webhook-security" },
      { title: "Testing", href: "/docs/server-sdks/testing" },
    ],
  },
  {
    title: "Reference",
    slug: "reference",
    items: [],
    groups: referenceManifest.navigation as NavGroup[],
  },
];

/**
 * Get all nav items in a flat list (for prev/next navigation)
 */
export function getAllNavItems(): NavItem[] {
  return docsNavigation.flatMap((section) => {
    const fromItems = section.items || [];
    const fromGroups = (section.groups || []).flatMap((g) => g.items);
    return [...fromItems, ...fromGroups];
  });
}

/**
 * Get previous and next navigation items for a given path
 */
export function getPrevNext(pathname: string): {
  prev: NavItem | null;
  next: NavItem | null;
} {
  const allItems = getAllNavItems();
  const index = allItems.findIndex((item) => item.href === pathname);

  return {
    prev: index > 0 ? allItems[index - 1] : null,
    next: index < allItems.length - 1 ? allItems[index + 1] : null,
  };
}

/**
 * Find the section and item for a given path
 */
export function findNavContext(pathname: string): {
  section: NavSection | null;
  item: NavItem | null;
} {
  for (const section of docsNavigation) {
    // Check direct items
    const directItem = section.items.find((item) => item.href === pathname);
    if (directItem) {
      return { section, item: directItem };
    }
    // Check groups
    if (section.groups) {
      for (const group of section.groups) {
        const groupItem = group.items.find((item) => item.href === pathname);
        if (groupItem) {
          return { section, item: groupItem };
        }
      }
    }
  }
  return { section: null, item: null };
}

/**
 * Get the first doc path (for redirecting from /docs)
 */
export function getFirstDocPath(): string {
  return docsNavigation[0]?.items[0]?.href ?? "/docs/get-started/what-is-pillar";
}
