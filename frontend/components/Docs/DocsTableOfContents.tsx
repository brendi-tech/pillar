'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * "On this page" table of contents for docs pages.
 * Extracts h2/h3 headings from the article and highlights the current section.
 */
export function DocsTableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const pathname = usePathname();

  // Extract headings from DOM on mount and when pathname changes
  useEffect(() => {
    // Reset state when pathname changes
    setHeadings([]);
    setActiveId('');

    // Small delay to ensure the new page content has rendered
    const timeoutId = setTimeout(() => {
      const article = document.querySelector('article');
      if (!article) return;

      const elements = article.querySelectorAll('h2[id], h3[id]');
      const items: TocItem[] = Array.from(elements).map((el) => ({
        id: el.id,
        text: el.textContent || '',
        level: el.tagName === 'H2' ? 2 : 3,
      }));
      setHeadings(items);

      // Set initial active heading
      if (items.length > 0) {
        setActiveId(items[0].id);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  // Track active section with Intersection Observer
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting heading
        const intersecting = entries.find((entry) => entry.isIntersecting);
        if (intersecting) {
          setActiveId(intersecting.target.id);
        }
      },
      {
        // Trigger when heading enters the top 20% of viewport
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  // Don't render if no headings
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="space-y-1" aria-label="Table of contents">
      <p className="text-sm font-medium text-foreground mb-3">On this page</p>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          onClick={(e) => {
            e.preventDefault();
            const element = document.getElementById(heading.id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
              // Update URL hash without jumping
              window.history.pushState(null, '', `#${heading.id}`);
            }
          }}
          className={cn(
            'block text-sm py-1 transition-colors',
            heading.level === 3 && 'pl-3',
            activeId === heading.id
              ? 'text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}
