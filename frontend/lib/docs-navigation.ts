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
 * Organized by user goals following the Diátaxis framework:
 * - Overview: Introduction and concepts
 * - Quickstarts: Framework-specific getting started guides
 * - Guides: Task-oriented how-to documentation
 * - Reference: API specifications and type definitions
 * - Knowledge Base: Content sources and configuration
 */
export const docsNavigation: NavSection[] = [
  {
    title: "Overview",
    slug: "overview",
    items: [
      { title: "Introduction", href: "/docs/overview/introduction" },
      { title: "How It Works", href: "/docs/overview/how-it-works" },
    ],
  },
  {
    title: "Quickstarts",
    slug: "quickstarts",
    items: [
      { title: "React", href: "/docs/quickstarts/react" },
      { title: "Vue", href: "/docs/quickstarts/vue" },
      { title: "Angular", href: "/docs/quickstarts/angular" },
      { title: "Vanilla JavaScript", href: "/docs/quickstarts/vanilla" },
    ],
  },
  {
    title: "Features",
    slug: "features",
    items: [
      { title: "Co-Pilot Chat", href: "/docs/features/chat" },
      { title: "Knowledge Base", href: "/docs/features/knowledge-base" },
      { title: "Tools", href: "/docs/features/tools" },
      { title: "Custom Cards", href: "/docs/features/custom-cards" },
      { title: "Human Escalation", href: "/docs/features/human-escalation" },
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
      { title: "Building Custom Cards", href: "/docs/guides/custom-cards" },
      { title: "Customizing the Panel", href: "/docs/guides/panel" },
      { title: "Theming & Branding", href: "/docs/guides/theme" },
      { title: "Text Selection Helper", href: "/docs/guides/text-selection" },
      { title: "Edge Trigger", href: "/docs/guides/edge-trigger" },
      { title: "Human Escalation", href: "/docs/guides/human-escalation" },
      { title: "Testing", href: "/docs/guides/testing" },
      { title: "Debug Mode", href: "/docs/guides/debug-mode" },
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
    title: "Reference",
    slug: "reference",
    items: [], // Individual items are inside groups
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
  return docsNavigation[0]?.items[0]?.href ?? "/docs/overview/introduction";
}
