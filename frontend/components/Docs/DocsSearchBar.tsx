"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";
import { usePillar } from "@pillar-ai/react";
import { useState, useCallback } from "react";

interface DocsSearchBarProps {
  /** Use compact layout for sidebar placement */
  compact?: boolean;
}

export function DocsSearchBar({ compact = false }: DocsSearchBarProps) {
  const { open } = usePillar();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        open({ search: query.trim() });
      }
    },
    [query, open]
  );

  const handleAskAI = useCallback(() => {
    open();
  }, [open]);

  if (compact) {
    // Compact vertical layout for sidebar
    return (
      <div className="space-y-2">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-12 w-full bg-muted/50 border-muted-foreground/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </form>

        {/* Ask AI Button */}
        <Button
          onClick={handleAskAI}
          variant="outline"
          size="sm"
          className="w-full gap-2 border-muted-foreground/20"
        >
          <Sparkles className="h-4 w-4" />
          Ask AI
        </Button>
      </div>
    );
  }

  // Wide horizontal layout (like Mintlify)
  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-12 w-full bg-muted/50 border-muted-foreground/20"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </form>

      {/* Ask AI Button */}
      <Button
        onClick={handleAskAI}
        variant="outline"
        size="sm"
        className="gap-2 border-muted-foreground/20 shrink-0"
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </Button>
    </div>
  );
}
