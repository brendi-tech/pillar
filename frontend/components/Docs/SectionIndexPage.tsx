"use client";

import Link from "next/link";
import { docsNavigation, type NavItem } from "@/lib/docs-navigation";
import { ChevronRight } from "lucide-react";

interface SectionIndexPageProps {
  sectionSlug: string;
  description?: string;
}

function ItemLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
    >
      <span className="font-medium text-foreground group-hover:text-primary">
        {item.title}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

/**
 * Reusable component for section index pages (e.g., /docs/guides, /docs/reference).
 * Displays all child pages in the section with links.
 * Supports both flat items and grouped items.
 */
export function SectionIndexPage({
  sectionSlug,
  description,
}: SectionIndexPageProps) {
  const section = docsNavigation.find((s) => s.slug === sectionSlug);

  if (!section) {
    return (
      <div className="prose dark:prose-invert max-w-none">
        <h1>Section Not Found</h1>
        <p>The requested documentation section could not be found.</p>
      </div>
    );
  }

  const hasGroups = section.groups && section.groups.length > 0;

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>{section.title}</h1>
      {description && <p className="lead text-muted-foreground">{description}</p>}

      {/* Flat items */}
      {section.items.length > 0 && (
        <div className="not-prose mt-8 grid gap-4">
          {section.items.map((item) => (
            <ItemLink key={item.href} item={item} />
          ))}
        </div>
      )}

      {/* Grouped items */}
      {hasGroups && (
        <div className="not-prose mt-8 space-y-8">
          {section.groups!.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.title}
              </h2>
              <div className="grid gap-2">
                {group.items.map((item) => (
                  <ItemLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
