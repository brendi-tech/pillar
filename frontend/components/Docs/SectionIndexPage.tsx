"use client";

import Link from "next/link";
import { docsNavigation, NavSection } from "@/lib/docs-navigation";
import { ChevronRight } from "lucide-react";

interface SectionIndexPageProps {
  sectionSlug: string;
  description?: string;
}

/**
 * Reusable component for section index pages (e.g., /docs/guides, /docs/reference).
 * Displays all child pages in the section with links.
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

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>{section.title}</h1>
      {description && <p className="lead text-muted-foreground">{description}</p>}

      <div className="not-prose mt-8 grid gap-4">
        {section.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
          >
            <span className="font-medium text-foreground group-hover:text-primary">
              {item.title}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
