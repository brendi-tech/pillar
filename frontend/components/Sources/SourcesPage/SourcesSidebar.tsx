"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "@/hooks/use-debounce";
import { knowledgeItemsAPI } from "@/lib/admin/knowledge-api";
import type { KnowledgeSourceSearchResponse } from "@/lib/admin/sources-api";
import { cn } from "@/lib/utils";
import { useSources } from "@/providers";
import { knowledgeKeys } from "@/queries/knowledge.queries";
import { knowledgeSourceSearchInfiniteOptions } from "@/queries/sources.queries";
import type {
  KnowledgeItem,
  KnowledgeItemListResponse,
} from "@/types/knowledge";
import type { KnowledgeSourceConfig } from "@/types/sources";
import { KNOWLEDGE_SOURCE_TYPE_LABELS } from "@/types/sources";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  Cloud,
  FileText,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSourcesWebSocketEvent } from "./useSourcesWebSocketEvent";

interface SourcesSidebarProps {
  /** Callback when navigation occurs (used to close mobile sidebar) */
  onNavigate?: () => void;
  hideHeader?: boolean;
}

/**
 * Parse source ID and item ID from the pathname.
 * Expected patterns:
 * - /knowledge → no selection
 * - /knowledge/[sourceId] → source selected
 * - /knowledge/[sourceId]/[itemId] → item selected
 * - /knowledge/new → new source wizard
 */
function parsePathname(pathname: string): {
  sourceId: string | null;
  itemId: string | null;
} {
  // Remove trailing slash and split
  const parts = pathname.replace(/\/$/, "").split("/");

  // Find the "knowledge" segment
  const knowledgeIndex = parts.indexOf("knowledge");
  if (knowledgeIndex === -1) {
    return { sourceId: null, itemId: null };
  }

  const sourceId = parts[knowledgeIndex + 1] || null;
  const itemId = parts[knowledgeIndex + 2] || null;

  // Filter out known sub-routes that aren't source IDs
  const nonSourceRoutes = ["new"];
  if (sourceId && nonSourceRoutes.includes(sourceId)) {
    return { sourceId: null, itemId: null };
  }

  return { sourceId, itemId };
}

function SourceTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case "help_center":
      return <BookOpen className={className} />;
    case "marketing_site":
    case "website_crawl":
      return <Globe className={className} />;
    case "cloud_storage":
      return <Cloud className={className} />;
    case "document_upload":
      return <Upload className={className} />;
    case "snippets":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function SourcesSidebar({
  onNavigate,
  hideHeader = false,
}: SourcesSidebarProps) {
  const { sources, isLoading, refresh } = useSources();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const pathname = usePathname();
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set()
  );

  const isSearchActive = debouncedSearch.length >= 2;

  // Server-side search: returns flat paginated items across sources
  const {
    data: searchData,
    isPending: isSearchLoading,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
  } = useInfiniteQuery(knowledgeSourceSearchInfiniteOptions(debouncedSearch));

  // Flatten all pages into a single items array
  const searchItems = useMemo(
    () =>
      searchData?.pages.flatMap(
        (page) => (page as KnowledgeSourceSearchResponse).results
      ) ?? [],
    [searchData]
  );

  // Merge source_counts from all pages (each page carries the full mapping)
  const sourceCounts = useMemo(() => {
    if (!searchData?.pages.length) return {};
    return (
      (searchData.pages[0] as KnowledgeSourceSearchResponse).source_counts ?? {}
    );
  }, [searchData]);

  // Build a source lookup from the provider for source metadata
  const sourceMap = useMemo(() => {
    const map = new Map<string, KnowledgeSourceConfig>();
    for (const s of sources) map.set(s.id, s);
    return map;
  }, [sources]);

  // Group search items by source, preserving insertion order
  const searchGrouped = useMemo(() => {
    if (!isSearchActive || searchItems.length === 0) return [];
    const groups = new Map<
      string,
      { source: KnowledgeSourceConfig | null; items: KnowledgeItem[] }
    >();
    for (const item of searchItems) {
      const sourceId = item.source;
      if (!groups.has(sourceId)) {
        groups.set(sourceId, {
          source: sourceMap.get(sourceId) ?? null,
          items: [],
        });
      }
      groups.get(sourceId)!.items.push(item);
    }
    return Array.from(groups.entries());
  }, [isSearchActive, searchItems, sourceMap]);

  // Parse current selection from pathname
  const { sourceId: currentSourceId, itemId: currentItemId } =
    parsePathname(pathname);

  // Auto-expand the selected source when navigating to it
  useMemo(() => {
    if (currentSourceId) {
      setExpandedSources((prev) => {
        if (prev.has(currentSourceId)) return prev;
        const next = new Set(prev);
        next.add(currentSourceId);
        return next;
      });
    }
  }, [currentSourceId]);

  const toggleExpanded = useCallback((sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // Sentinel for loading more search results on scroll
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isSearchActive) return;
    const el = searchSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextSearchPage &&
          !isFetchingNextSearchPage
        ) {
          fetchNextSearchPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [
    isSearchActive,
    hasNextSearchPage,
    isFetchingNextSearchPage,
    fetchNextSearchPage,
  ]);

  const effectiveLoading = isSearchActive ? isSearchLoading : isLoading;

  return (
    <div className="bg-background flex h-full w-80 flex-col overflow-hidden border-r">
      {/* Header */}
      {!hideHeader && (
        <div className="shrink-0 border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Knowledge</h2>
              <p className="text-muted-foreground text-xs">
                {sources.length} source{sources.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refresh();
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                className="h-8 w-8"
                title="Refresh sources"
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <Button asChild size="icon" className="h-8 w-8">
                <Link href="/knowledge/new" title="Add source">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus={false}
            />
          </div>
          {hideHeader && (
            <Button asChild size="icon" className="h-9 w-9 shrink-0">
              <Link
                href="/knowledge/new"
                onClick={onNavigate}
                title="Add source"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sources List */}
      <ScrollArea
        className="flex-1 w-full overflow-hidden"
        viewportClassName="[&>div]:!w-full [&>div]:overflow-hidden [&>div]:!block pr-1"
      >
        <div className="p-2 space-y-0.5 overflow-hidden">
          {effectiveLoading ? (
            <SourcesSkeleton />
          ) : isSearchActive ? (
            searchGrouped.length === 0 ? (
              <EmptyState
                searchTerm={debouncedSearch}
                hasAnySources={sources.length > 0}
              />
            ) : (
              <>
                {searchGrouped.map(([sourceId, { source, items }]) =>
                  source ? (
                    <CollapsibleSourceItem
                      key={sourceId}
                      source={source}
                      isSourceSelected={sourceId === currentSourceId}
                      currentItemId={currentItemId}
                      isExpanded={
                        expandedSources.has(sourceId) || items.length > 0
                      }
                      onToggleExpand={() => toggleExpanded(sourceId)}
                      onNavigate={onNavigate}
                      preloadedItems={items}
                      searchResultCount={sourceCounts[sourceId] ?? items.length}
                    />
                  ) : (
                    <CollapsibleSearchGroup
                      key={sourceId}
                      sourceId={sourceId}
                      sourceName={items[0]?.source_name ?? "Unknown source"}
                      items={items}
                      totalCount={sourceCounts[sourceId]}
                      currentItemId={currentItemId}
                      isExpanded={
                        expandedSources.has(sourceId) || items.length > 0
                      }
                      onToggleExpand={() => toggleExpanded(sourceId)}
                      onNavigate={onNavigate}
                    />
                  )
                )}
                <div ref={searchSentinelRef} className="h-1" />
                {isFetchingNextSearchPage && (
                  <div className="flex w-full items-center justify-center py-2">
                    <Spinner size="xs" />
                  </div>
                )}
              </>
            )
          ) : sources.length === 0 ? (
            <EmptyState searchTerm="" hasAnySources={false} />
          ) : (
            // Normal mode: render from provider with lazy-loaded items
            sources.map((source) => (
              <CollapsibleSourceItem
                key={source.id}
                source={source}
                isSourceSelected={source.id === currentSourceId}
                currentItemId={currentItemId}
                isExpanded={expandedSources.has(source.id)}
                onToggleExpand={() => toggleExpanded(source.id)}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CollapsibleSourceItemProps {
  source: KnowledgeSourceConfig;
  isSourceSelected: boolean;
  currentItemId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate?: () => void;
  /** When provided (search mode), renders these items directly instead of fetching. */
  preloadedItems?: KnowledgeItem[];
  /** When set (search mode), shown as "N results" instead of total item count. */
  searchResultCount?: number;
}

function CollapsibleSourceItem({
  source,
  isSourceSelected,
  currentItemId,
  isExpanded,
  onToggleExpand,
  onNavigate,
  preloadedItems,
  searchResultCount,
}: CollapsibleSourceItemProps) {
  const usePreloaded = preloadedItems !== undefined;
  const pageSize = 50;

  // Fetch items with infinite pagination when expanded (only in normal mode)
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<KnowledgeItemListResponse>({
      queryKey: knowledgeKeys.itemList({
        source: source.id,
        page_size: pageSize,
      }),
      queryFn: ({ pageParam }) =>
        knowledgeItemsAPI.list({
          source: source.id,
          page: pageParam as number,
          page_size: pageSize,
        }),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.next ? allPages.length + 1 : undefined,
      initialPageParam: 1,
      enabled: isExpanded && !usePreloaded,
    });

  // Handle WebSocket events for real-time item updates
  useSourcesWebSocketEvent({ sourceId: source.id, pageSize });

  const items = usePreloaded
    ? preloadedItems
    : (data?.pages.flatMap((page) => page.results) ?? []);

  // Auto-load next page when sentinel scrolls into view (only in normal mode)
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (usePreloaded) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [usePreloaded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <button
            className="flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-md"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <Link
          href={`/knowledge/${source.id}`}
          onClick={onNavigate}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-3 sm:py-1.5 text-sm transition-colors",
            "hover:bg-muted",
            isSourceSelected && !currentItemId && "bg-muted font-medium"
          )}
        >
          <SourceTypeIcon
            type={source.source_type}
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <div className="truncate">{source.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {searchResultCount !== undefined
                ? `${searchResultCount} result${searchResultCount !== 1 ? "s" : ""}`
                : `${KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]} · ${source.item_count} items`}
            </div>
          </div>
          {source.status === "syncing" && (
            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
          )}
          {source.status === "error" && (
            <span className="h-2 w-2 rounded-full bg-red-500" />
          )}
        </Link>
      </div>
      <CollapsibleContent>
        <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
          {!usePreloaded && isPending ? (
            <ItemsSkeleton />
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-2">
              No items yet
            </p>
          ) : (
            <>
              {items.map((item) => (
                <ItemListItem
                  key={item.id}
                  item={item}
                  sourceId={source.id}
                  isSelected={item.id === currentItemId}
                  onNavigate={onNavigate}
                />
              ))}
              {!usePreloaded && (
                <>
                  <div ref={sentinelRef} className="h-1" />
                  {isFetchingNextPage && (
                    <div className="flex w-full items-center justify-center py-1.5">
                      <Spinner size="xs" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ItemListItemProps {
  item: KnowledgeItem;
  sourceId: string;
  isSelected: boolean;
  onNavigate?: () => void;
}

function ItemListItem({
  item,
  sourceId,
  isSelected,
  onNavigate,
}: ItemListItemProps) {
  return (
    <Link
      href={`/knowledge/${sourceId}/${item.id}`}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-3 sm:py-1.5 text-sm transition-colors",
        "hover:bg-muted",
        isSelected && "bg-muted font-medium"
      )}
    >
      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">{item.title || "Untitled"}</span>
      {item.status === "processing" && <Spinner size="xs" />}
      {item.status === "indexed" && item.has_optimized_content && (
        <span className="h-2 w-2 rounded-full bg-green-500" />
      )}
      {item.status === "indexed" && !item.has_optimized_content && (
        <span className="h-2 w-2 rounded-full bg-green-400/60" />
      )}
      {item.status === "failed" && (
        <span className="h-2 w-2 rounded-full bg-red-500" />
      )}
    </Link>
  );
}

/**
 * Fallback search group when the source config isn't in the provider cache.
 * Uses the source_name from the item data.
 */
function CollapsibleSearchGroup({
  sourceId,
  sourceName,
  items,
  totalCount,
  currentItemId,
  isExpanded,
  onToggleExpand,
  onNavigate,
}: {
  sourceId: string;
  sourceName: string;
  items: KnowledgeItem[];
  totalCount?: number;
  currentItemId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate?: () => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <button
            className="flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-md"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <Link
          href={`/knowledge/${sourceId}`}
          onClick={onNavigate}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-3 sm:py-1.5 text-sm transition-colors hover:bg-muted"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{sourceName}</div>
            <div className="text-xs text-muted-foreground truncate">
              {totalCount ?? items.length} result
              {(totalCount ?? items.length) !== 1 ? "s" : ""}
            </div>
          </div>
        </Link>
      </div>
      <CollapsibleContent>
        <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
          {items.map((item) => (
            <ItemListItem
              key={item.id}
              item={item}
              sourceId={sourceId}
              isSelected={item.id === currentItemId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ItemsSkeleton() {
  return (
    <div className="space-y-1 py-1">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  );
}

function SourcesSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  searchTerm,
  hasAnySources,
}: {
  searchTerm: string;
  hasAnySources: boolean;
}) {
  if (searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">
          No results for &quot;{searchTerm}&quot;
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Try a different search term
        </p>
      </div>
    );
  }

  if (!hasAnySources) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          No knowledge sources yet
        </p>
        <Button asChild size="sm">
          <Link href="/knowledge/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Source
          </Link>
        </Button>
      </div>
    );
  }

  return null;
}
