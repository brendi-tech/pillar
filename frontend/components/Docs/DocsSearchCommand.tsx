"use client";

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchDocs, type SearchResult } from "@/lib/docs-search-api";
import { AlertCircle, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface DocsSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocsSearchCommand({
  open,
  onOpenChange,
}: DocsSearchCommandProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  console.log(results);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setError(null);
    }
  }, [open]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    // Reset hasSearched when query changes (during debounce)
    setHasSearched(false);
    setError(null);

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await searchDocs(query);
        setResults(searchResults);
        setError(null);
      } catch (err) {
        console.error("[DocsSearch] Failed to search:", err);
        setResults([]);
        setError("Search is temporarily unavailable. Please try again.");
      } finally {
        setIsLoading(false);
        setHasSearched(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      // Navigate to the result URL
      if (result.url) {
        router.push(result.url);
      }
    },
    [onOpenChange, router]
  );

  // Parse breadcrumb from URL or source_name
  const getBreadcrumb = (result: SearchResult): string => {
    if (result.source_name) {
      return result.source_name;
    }
    if (result.url) {
      // Extract path segments from URL
      const path = result.url.replace(/^\/docs\//, "").replace(/\//g, " > ");
      return path || "Docs";
    }
    return "Docs";
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search documentation"
      description="Search documentation"
      className="max-w-[600px]"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {/* Loading state */}
        {isLoading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="px-4 py-6 text-center text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
            <div className="text-muted-foreground">{error}</div>
          </div>
        )}

        {/* No results found - only show after search actually completes */}
        {!isLoading &&
          !error &&
          hasSearched &&
          query &&
          results.length === 0 && (
            <div className="py-6 text-center text-sm">
              <div className="text-muted-foreground">No results found for</div>
              <div className="font-medium mt-1">&ldquo;{query}&rdquo;</div>
            </div>
          )}

        {results.length > 0 && (
          <CommandGroup>
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={result.id}
                onSelect={() => handleSelectResult(result)}
                className="flex items-start gap-3 py-3"
              >
                <Hash className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {getBreadcrumb(result)}
                  </div>
                  <div className="font-medium">{result.title}</div>
                  {result.excerpt && (
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {result.excerpt}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
