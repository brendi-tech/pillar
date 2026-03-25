"use client";

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
import { mcpSourceListQuery } from "@/queries/mcpSource.queries";
import { openAPISourceListQuery } from "@/queries/openAPISource.queries";
import type { ActionListResponse } from "@/types/actions";
import type { MCPToolSource } from "@/types/mcpSource";
import type { OpenAPIToolSource } from "@/types/openAPISource";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Globe,

  Monitor,
  Plus,
  RefreshCw,
  Search,
  Server,
  Unplug,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "./EmptyState";
import { ToolListItem } from "./ToolListItem";
import {
  groupToolsBySource,
  parseMcpItemFromSearchParams,
  parseMcpSourceIdFromPathname,
  parseOpenAPISourceIdFromPathname,
  parseToolGroupFromPathname,
  parseToolIdFromPathname,
  TOOL_SOURCE_LABELS,
  type ToolSourceGroup,
} from "./ToolsSidebar.helpers";
import type { ToolsSidebarProps } from "./ToolsSidebar.types";
import { ToolsSkeleton } from "./ToolsSkeleton";

const SOURCE_ICONS: Record<ToolSourceGroup, typeof Monitor> = {
  client_side: Monitor,
  server_side: Server,
};

export function ToolsSidebar({
  onNavigate,
  hideHeader = false,
}: ToolsSidebarProps) {
  const { currentProduct } = useProduct();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const { data: mcpSources, isPending: isMcpPending } = useQuery({
    ...mcpSourceListQuery(currentProduct?.id ?? ""),
    enabled: !!currentProduct?.id,
  });

  const { data: openAPISources, isPending: isOpenAPIPending } = useQuery({
    ...openAPISourceListQuery(currentProduct?.id ?? ""),
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
  const currentMcpSourceId = parseMcpSourceIdFromPathname(pathname);
  const currentOpenAPISourceId = parseOpenAPISourceIdFromPathname(pathname);
  const currentToolGroup = parseToolGroupFromPathname(pathname);
  const activeMcpItem = useMemo(
    () => parseMcpItemFromSearchParams(searchParams),
    [searchParams]
  );

  const mcpToolCount = useMemo(
    () => mcpSources?.reduce((sum, s) => sum + (s.tool_count ?? 0), 0) ?? 0,
    [mcpSources]
  );

  const openAPIOpCount = useMemo(
    () => openAPISources?.reduce((sum, s) => sum + (s.operation_count ?? 0), 0) ?? 0,
    [openAPISources]
  );

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

  const groupedTools = useMemo(() => groupToolsBySource(tools), [tools]);

  const HEADER_H = 32;
  const stickyOffsets = useMemo(() => {
    const map = new Map<string, { top: number; zIndex: number }>();
    let top = 0;
    let z = 50;

    for (const [source, sourceTools] of Object.entries(groupedTools) as [string, typeof tools][]) {
      if (sourceTools.length > 0) {
        map.set(source, { top, zIndex: z });
        top += HEADER_H;
        z -= 2;
      }
    }
    if (mcpSources?.length) {
      map.set("mcp-label", { top, zIndex: z });
      top += HEADER_H;
      z -= 2;
      for (const s of mcpSources) {
        map.set(s.id, { top, zIndex: z });
        top += HEADER_H;
        z -= 2;
      }
    }
    if (openAPISources?.length) {
      map.set("api-label", { top, zIndex: z });
      top += HEADER_H;
      z -= 2;
      for (const s of openAPISources) {
        map.set(`openapi-${s.id}`, { top, zIndex: z });
        top += HEADER_H;
        z -= 2;
      }
    }
    return map;
  }, [groupedTools, mcpSources, openAPISources]);

  const allGroupIds = useMemo(() => {
    const ids = Object.entries(groupedTools)
      .filter(([, t]) => t.length > 0)
      .map(([key]) => key);
    if (mcpSources) {
      for (const s of mcpSources) ids.push(s.id);
    }
    if (openAPISources) {
      for (const s of openAPISources) ids.push(`openapi-${s.id}`);
    }
    return ids;
  }, [groupedTools, mcpSources, openAPISources]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(allGroupIds)
  );

  useEffect(() => {
    setExpandedGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of allGroupIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allGroupIds]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const prevNavRef = useRef({ currentMcpSourceId, currentToolId, currentToolGroup });

  useEffect(() => {
    const prev = prevNavRef.current;
    const navChanged =
      prev.currentMcpSourceId !== currentMcpSourceId ||
      prev.currentToolId !== currentToolId ||
      prev.currentToolGroup !== currentToolGroup;

    prevNavRef.current = { currentMcpSourceId, currentToolId, currentToolGroup };

    if (!navChanged) return;

    if (currentMcpSourceId) {
      setExpandedGroups((g) => new Set([...g, currentMcpSourceId]));
    } else if (currentToolId) {
      const tool = tools.find((t) => t.id === currentToolId);
      if (tool) {
        const group = tool.tool_type === "client_side" ? "client_side" : "server_side";
        setExpandedGroups((g) => new Set([...g, group]));
      }
    } else if (currentToolGroup) {
      setExpandedGroups((g) => new Set([...g, currentToolGroup]));
    }
  }, [currentMcpSourceId, currentToolId, currentToolGroup, tools]);

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
          totalCount={totalCount + mcpToolCount + openAPIOpCount}
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
        viewportClassName="[&>div]:!w-full [&>div]:!block"
      >
        <div className="p-2 space-y-1">
          {isLoading ? (
            <ToolsSkeleton />
          ) : tools.length === 0 && (!mcpSources || mcpSources.length === 0) && (!openAPISources || openAPISources.length === 0) ? (
            <EmptyState
              searchTerm={isSearchActive ? debouncedSearch : ""}
              hasAnyTools={totalCount > 0}
            />
          ) : (
            <>
              {(
                Object.entries(groupedTools) as [ToolSourceGroup, typeof tools][]
              ).map(([source, sourceTools]) => {
                if (sourceTools.length === 0) return null;

                const Icon = SOURCE_ICONS[source];
                const isExpanded = expandedGroups.has(source);
                const offset = stickyOffsets.get(source);

                return (
                  <Fragment key={source}>
                    <div
                      className="bg-background flex items-center"
                      style={{ position: "sticky", top: offset?.top ?? 0, zIndex: offset?.zIndex ?? 10 }}
                    >
                      <button
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                        onClick={() => toggleGroup(source)}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                      <Link
                        href={`/tools/${source === "client_side" ? "client" : "server"}`}
                        onClick={onNavigate}
                        className={cn(
                          "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                          currentToolGroup === source
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {TOOL_SOURCE_LABELS[source]}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground/60">
                          {sourceTools.length}
                        </span>
                      </Link>
                    </div>
                    <Collapsible open={isExpanded}>
                      <CollapsibleContent>
                        <div className="ml-4 space-y-0.5 py-1">
                          {sourceTools.map((tool) => (
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
                  </Fragment>
                );
              })}

              {!isMcpPending && mcpSources && mcpSources.length > 0 && (
                <>
                  <div
                    className="-mx-2 bg-background flex items-center gap-2 pl-5 pr-4 pt-3 pb-1"
                    style={{
                      position: "sticky",
                      top: stickyOffsets.get("mcp-label")?.top ?? 0,
                      zIndex: stickyOffsets.get("mcp-label")?.zIndex ?? 20,
                    }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      MCP Servers
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {mcpSources.map((source) => (
                    <MCPSourceItem
                      key={source.id}
                      source={source}
                      isSelected={source.id === currentMcpSourceId}
                      isExpanded={expandedGroups.has(source.id)}
                      onToggleExpand={() => toggleGroup(source.id)}
                      onNavigate={onNavigate}
                      activeItemName={
                        source.id === currentMcpSourceId
                          ? activeMcpItem?.name ?? null
                          : null
                      }
                      stickyTop={stickyOffsets.get(source.id)?.top ?? 0}
                      stickyZIndex={stickyOffsets.get(source.id)?.zIndex ?? 10}
                    />
                  ))}
                </>
              )}

              {!isOpenAPIPending && openAPISources && openAPISources.length > 0 && (
                <>
                  <div
                    className="-mx-2 bg-background flex items-center gap-2 pl-5 pr-4 pt-3 pb-1"
                    style={{
                      position: "sticky",
                      top: stickyOffsets.get("api-label")?.top ?? 0,
                      zIndex: stickyOffsets.get("api-label")?.zIndex ?? 20,
                    }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      API Sources
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {openAPISources.map((source) => (
                    <OpenAPISourceItem
                      key={source.id}
                      source={source}
                      isSelected={source.id === currentOpenAPISourceId}
                      isExpanded={expandedGroups.has(`openapi-${source.id}`)}
                      onToggleExpand={() => toggleGroup(`openapi-${source.id}`)}
                      onNavigate={onNavigate}
                      stickyTop={stickyOffsets.get(`openapi-${source.id}`)?.top ?? 0}
                      stickyZIndex={stickyOffsets.get(`openapi-${source.id}`)?.zIndex ?? 10}
                    />
                  ))}
                </>
              )}

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
          <Button asChild size="icon" className="h-8 w-8">
            <Link href="/tools/new" title="Add tools">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
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
            <Button asChild size="icon" className="h-9 w-9 shrink-0">
              <Link
                href="/tools/new"
                onClick={onNavigate}
                title="Add tools"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function MCPSourceItem({
  source,
  isSelected,
  isExpanded,
  onToggleExpand,
  onNavigate,
  activeItemName,
  stickyTop,
  stickyZIndex,
}: {
  source: MCPToolSource;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate?: () => void;
  activeItemName: string | null;
  stickyTop: number;
  stickyZIndex: number;
}) {
  const isError =
    source.discovery_status === "error" || source.consecutive_failures > 0;
  const isHealthy = source.discovery_status === "success" && !isError;

  const totalCount =
    (source.tool_count ?? 0) +
    (source.resource_count ?? 0) +
    (source.prompt_count ?? 0);

  return (
    <>
      <div
        className="bg-background flex items-center"
        style={{ position: "sticky", top: stickyTop, zIndex: stickyZIndex }}
      >
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </button>
        <Link
          href={`/tools/mcp/${source.id}`}
          onClick={onNavigate}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            "hover:bg-muted",
            isSelected && "bg-muted font-medium"
          )}
        >
          <Unplug className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{source.name}</div>
          </div>
          <span className="text-xs text-muted-foreground/60 shrink-0">
            {totalCount}
          </span>
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              isHealthy && "bg-green-500",
              isError && "bg-red-500",
              !isHealthy && !isError && "bg-yellow-500"
            )}
            title={
              isHealthy
                ? "Healthy"
                : isError
                  ? source.discovery_error || "Connection error"
                  : "Pending"
            }
          />
        </Link>
      </div>
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
            {totalCount === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-2">
                Nothing discovered yet
              </p>
            ) : (
              <>
                <MCPSubSection
                  icon={Wrench}
                  label="Tools"
                  items={source.discovered_tools}
                  getItemName={(t) => t.name}
                  getItemHref={(t) =>
                    `/tools/mcp/${source.id}?tool=${encodeURIComponent(t.name)}`
                  }
                  activeItemName={activeItemName}
                  onNavigate={onNavigate}
                />
                <MCPSubSection
                  icon={FileText}
                  label="Resources"
                  items={source.discovered_resources}
                  getItemName={(r) => r.name}
                  getItemHref={(r) =>
                    `/tools/mcp/${source.id}?resource=${encodeURIComponent(r.name)}`
                  }
                  activeItemName={activeItemName}
                  onNavigate={onNavigate}
                />
                <MCPSubSection
                  icon={BookOpen}
                  label="Prompts"
                  items={source.discovered_prompts ?? []}
                  getItemName={(p) => p.name}
                  getItemHref={(p) =>
                    `/tools/mcp/${source.id}?prompt=${encodeURIComponent(p.name)}`
                  }
                  activeItemName={activeItemName}
                  onNavigate={onNavigate}
                />
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function OpenAPISourceItem({
  source,
  isSelected,
  isExpanded,
  onToggleExpand,
  onNavigate,
  stickyTop,
  stickyZIndex,
}: {
  source: OpenAPIToolSource;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate?: () => void;
  stickyTop: number;
  stickyZIndex: number;
}) {
  const isError = source.discovery_status === "error";
  const isHealthy = source.discovery_status === "success" && !isError;

  return (
    <>
      <div
        className="bg-background flex items-center"
        style={{ position: "sticky", top: stickyTop, zIndex: stickyZIndex }}
      >
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </button>
        <Link
          href={`/tools/openapi/${source.id}`}
          onClick={onNavigate}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            "hover:bg-muted",
            isSelected && "bg-muted font-medium"
          )}
        >
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{source.name}</div>
          </div>
          <span className="text-xs text-muted-foreground/60 shrink-0">
            {source.operation_count}
          </span>
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              isHealthy && "bg-green-500",
              isError && "bg-red-500",
              !isHealthy && !isError && "bg-yellow-500"
            )}
            title={
              isHealthy
                ? "Healthy"
                : isError
                  ? source.discovery_error || "Error"
                  : "Pending"
            }
          />
        </Link>
      </div>
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
            {source.discovered_operations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-2">
                No operations discovered yet
              </p>
            ) : (
              source.discovered_operations.map((op) => (
                <Link
                  key={op.operation_id}
                  href={`/tools/openapi/${source.id}?op=${encodeURIComponent(op.operation_id)}`}
                  onClick={onNavigate}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted text-muted-foreground"
                >
                  <span className="text-[10px] font-mono font-semibold uppercase shrink-0">
                    {op.method}
                  </span>
                  <span className="truncate flex-1 font-mono text-xs">
                    {op.path}
                  </span>
                </Link>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function MCPSubSection<T>({
  icon: Icon,
  label,
  items,
  getItemName,
  getItemHref,
  activeItemName,
  onNavigate,
}: {
  icon: typeof Wrench;
  label: string;
  items: T[];
  getItemName: (item: T) => string;
  getItemHref: (item: T) => string;
  activeItemName: string | null;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {items.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 space-y-0.5 py-0.5">
          {items.map((item) => {
            const name = getItemName(item);
            const isActive = activeItemName === name;
            return (
              <Link
                key={name}
                href={getItemHref(item)}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <span className="truncate flex-1">{name}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
