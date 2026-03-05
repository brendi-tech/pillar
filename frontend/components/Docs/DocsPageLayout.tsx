"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavContext, getPrevNext } from "@/lib/docs-navigation";
import { DocsToolbar } from "./DocsToolbar";
import { DocsSDKPicker, shouldShowSDKPicker } from "./DocsSDKPicker";

interface DocsPageLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper for individual doc pages.
 * Provides breadcrumb, prose styling, and prev/next navigation.
 */
export function DocsPageLayout({ children }: DocsPageLayoutProps) {
  const pathname = usePathname();
  const { section, item } = findNavContext(pathname);
  const { prev, next } = getPrevNext(pathname);
  const showSDKPicker = shouldShowSDKPicker(pathname);

  return (
    <div>
      {/* Breadcrumb + toolbar — sticky below the header */}
      <div className="mb-5">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          {section && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-muted-foreground/70">{section.title}</span>
            </>
          )}
          {item && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-muted-foreground/70">{item.title}</span>
            </>
          )}
        </nav>

        <DocsToolbar />
      </div>

      {showSDKPicker && <DocsSDKPicker />}

      {/* Doc Content */}
      <article className="prose dark:prose-invert max-w-none text-foreground">{children}</article>

      {/* Prev/Next Navigation */}
      <footer className="mt-12 pt-6 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={prev.href}
              className="group flex flex-col items-start text-left"
            >
              <span className="text-xs text-muted-foreground mb-1">
                Previous
              </span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next && (
            <Link
              href={next.href}
              className="group flex flex-col items-end text-right"
            >
              <span className="text-xs text-muted-foreground mb-1">Next</span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {next.title}
              </span>
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
