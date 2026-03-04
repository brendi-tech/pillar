"use client";

import { ToolsSyncModal } from "@/components/ToolsSyncModal";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "@/hooks/use-debounce";
import { useWebSocketEvent } from "@/hooks/use-websocket-event";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers";
import {
  actionKeys,
  actionListInfiniteOptions,
} from "@/queries/actions.queries";
import type { ActionListResponse, ActionType } from "@/types/actions";
import { ACTION_TYPE_LABELS } from "@/types/actions";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Code2,
  RefreshCw,
  Rocket,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "./EmptyState";
import { ToolListItem } from "./ToolListItem";
import {
  groupToolsByType,
  parseToolIdFromPathname,
  TOOL_TYPE_ICONS,
} from "./ToolsSidebar.helpers";
import type { ToolsSidebarProps } from "./ToolsSidebar.types";
import { ToolsSkeleton } from "./ToolsSkeleton";

export function ToolsSidebar({
  onNavigate,
  hideHeader = false,
}: ToolsSidebarProps) {
  const { currentProduct } = useProduct();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const pathname = usePathname();

  const queryClient = useQueryClient();

  const isSearchActive = debouncedSearch.length >= 2;

  const {
    data,
    isPending,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ActionListResponse>({
    ...actionListInfiniteOptions(
      {
        product: currentProduct?.id,
        search: isSearchActive ? debouncedSearch : undefined,
        ordering: "action_type,name",
      },
      50
    ),
    enabled: !!currentProduct?.id,
  });

  const isLoading = !currentProduct?.id || isPending;

  const handleSyncCompleted = useCallback(
    (event: CustomEvent) => {
      const { created, updated, deleted } = event.detail;
      queryClient.invalidateQueries({ queryKey: actionKeys.all });
      toast.success(
        `Tools synced: ${created} created, ${updated} updated, ${deleted} deleted`
      );
    },
    [queryClient]
  );

  useWebSocketEvent("websocket:actions.sync_completed", handleSyncCompleted);

  const tools = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data?.pages]
  );

  const totalCount = data?.pages[0]?.count ?? 0;

  const currentToolId = parseToolIdFromPathname(pathname);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const groupedTools = useMemo(() => groupToolsByType(tools), [tools]);

  const [expandedGroups, setExpandedGroups] = useState<Set<ActionType>>(
    new Set(Object.keys(ACTION_TYPE_LABELS) as ActionType[])
  );

  const toggleGroup = (type: ActionType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex h-full w-80 flex-col overflow-hidden border-r bg-background">
      {!hideHeader && (
        <SidebarHeader
          totalCount={totalCount}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      )}

      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        hideHeader={hideHeader}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onNavigate={onNavigate}
      />

      <ScrollArea
        className="flex-1 w-full overflow-hidden"
        viewportClassName="[&>div]:!w-full [&>div]:overflow-hidden [&>div]:!block"
      >
        <div className="p-2 space-y-1 overflow-hidden">
          {isLoading ? (
            <ToolsSkeleton />
          ) : tools.length === 0 ? (
            <EmptyState
              searchTerm={isSearchActive ? debouncedSearch : ""}
              hasAnyTools={totalCount > 0}
            />
          ) : (
            <>
              {Object.entries(groupedTools).map(([type, typeTools]) => {
                if (typeTools.length === 0) return null;

                const toolType = type as ActionType;
                const Icon = TOOL_TYPE_ICONS[toolType];
                const isExpanded = expandedGroups.has(toolType);

                return (
                  <Collapsible
                    key={type}
                    open={isExpanded}
                    onOpenChange={() => toggleGroup(toolType)}
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {ACTION_TYPE_LABELS[toolType]}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 space-y-0.5 py-1">
                        {typeTools.map((tool) => (
                          <ToolListItem
                            key={tool.id}
                            action={tool}
                            isSelected={tool.id === currentToolId}
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
              <div ref={sentinelRef} className="h-1" />
              {isFetchingNextPage && (
                <div className="flex w-full items-center justify-center py-2">
                  <Spinner size="xs" />
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-3">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Tools are defined in code and synced via CI/CD.</span>
        </div>
      </div>
    </div>
  );
}

function SidebarHeader({
  totalCount,
  isRefreshing,
  onRefresh,
}: {
  totalCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="shrink-0 border-b p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tools</h2>
          <p className="text-xs text-muted-foreground">
            {totalCount} tool{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
            title="Refresh tools"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/tools/deployments" title="View deployments">
              <Rocket className="h-4 w-4" />
            </Link>
          </Button>
          <ToolsSyncModal
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Configure sync"
              >
                <Settings className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}

function SearchBar({
  searchTerm,
  onSearchChange,
  hideHeader,
  isRefreshing,
  onRefresh,
  onNavigate,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  hideHeader: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="shrink-0 border-b p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            autoFocus={false}
          />
        </div>
        {hideHeader && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-9 w-9"
              title="Refresh tools"
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9">
              <Link
                href="/tools/deployments"
                onClick={onNavigate}
                title="View deployments"
              >
                <Rocket className="h-4 w-4" />
              </Link>
            </Button>
            <ToolsSyncModal
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Configure sync"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
