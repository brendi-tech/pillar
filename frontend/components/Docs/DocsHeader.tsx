"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { Search } from "lucide-react";
import Link from "next/link";

interface DocsHeaderProps {
  onOpenSearch: () => void;
}

export function DocsHeader({ onOpenSearch }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Full-width container with centered search */}
      <div className="relative flex h-14 items-center px-4">
        {/* Left: Logo aligned with sidebar (inside max-width container) */}
        <div className="mx-auto w-full flex items-center justify-between max-w-[1248px]">
          <Link href="/docs" className="flex items-center w-fit">
            <PillarLogoWithName className="h-6" />
          </Link>

          {/* Center: Search + Ask AI - absolutely centered on viewport */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Search Button - triggers command palette */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 rounded-lg border border-input bg-muted/50 px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors w-48 sm:w-64"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
