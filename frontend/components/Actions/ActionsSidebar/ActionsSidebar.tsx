"use client";

import { ActionSyncModal } from "@/components/ActionsPageContent/ActionSyncModal";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useWebSocketEvent } from "@/hooks/use-websocket-event";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers";
import { actionKeys, actionListQuery } from "@/queries/actions.queries";
import type { Action, ActionType } from "@/types/actions";
import { ACTION_TYPE_LABELS, deriveActionLabel } from "@/types/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Layout,
  LayoutPanelLeft,
  Pencil,
  PlayCircle,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface ActionsSidebarProps {
  /** Callback when navigation occurs (used to close mobile sidebar) */
  onNavigate?: () => void;
  hideHeader?: boolean;
}

/**
 * Icon mapping for action types
 */
const ACTION_TYPE_ICON_COMPONENTS: Record<ActionType, LucideIcon> = {
  navigate: ArrowRight,
  open_modal: Layout,
  fill_form: Pencil,
  trigger_tool: Zap,
  trigger_action: Zap, // @deprecated alias
  query: Database,
  copy_text: Copy,
  external_link: ExternalLink,
  start_tutorial: PlayCircle,
  inline_ui: LayoutPanelLeft,
};

/**
 * Parse action ID from the pathname.
 * Expected patterns:
 * - /actions → no selection
 * - /tools/[actionId] → action selected
 * - /tools/deployments → deployments page
 * - /tools/new → new action wizard
 */
function parsePathname(pathname: string): { actionId: string | null } {
  const parts = pathname.replace(/\/$/, "").split("/");
  const actionsIndex = parts.indexOf("tools");

  if (actionsIndex === -1) {
    return { actionId: null };
  }

  const actionId = parts[actionsIndex + 1] || null;

  // Filter out known sub-routes that aren't action IDs
  const nonActionRoutes = ["new", "deployments"];
  if (actionId && nonActionRoutes.includes(actionId)) {
    return { actionId: null };
  }

  return { actionId };
}

/**
 * Group actions by their action_type
 */
function groupActionsByType(actions: Action[]): Record<ActionType, Action[]> {
  const groups: Record<ActionType, Action[]> = {
    navigate: [],
    open_modal: [],
    fill_form: [],
    trigger_tool: [],
    trigger_action: [], // @deprecated alias
    query: [],
    copy_text: [],
    external_link: [],
    start_tutorial: [],
    inline_ui: [],
  };

  for (const action of actions) {
    if (groups[action.action_type]) {
      groups[action.action_type].push(action);
    }
  }

  return groups;
}

export function ActionsSidebar({
  onNavigate,
  hideHeader = false,
}: ActionsSidebarProps) {
  const { currentProduct } = useProduct();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const pathname = usePathname();

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
      page_size: 100,
    })
  );

  const handleSyncCompleted = useCallback(
    (event: CustomEvent) => {
      const { created, updated, deleted } = event.detail;
      queryClient.invalidateQueries({ queryKey: actionKeys.all });
      toast.success(
        `Actions synced: ${created} created, ${updated} updated, ${deleted} deleted`
      );
    },
    [queryClient]
  );

  useWebSocketEvent("websocket:actions.sync_completed", handleSyncCompleted);

  const actions = useMemo(() => data?.results ?? [], [data?.results]);

  // Parse current selection from pathname
  const { actionId: currentActionId } = parsePathname(pathname);

  // Filter actions by search term
  const filteredActions = useMemo(() => {
    if (!debouncedSearch) return actions;
    const lower = debouncedSearch.toLowerCase();
    return actions.filter(
      (action) =>
        action.name.toLowerCase().includes(lower) ||
        action.description.toLowerCase().includes(lower)
    );
  }, [actions, debouncedSearch]);

  // Group filtered actions by type
  const groupedActions = useMemo(
    () => groupActionsByType(filteredActions),
    [filteredActions]
  );
  console.log(filteredActions);

  // Track which groups are expanded
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

  return (
    <div className="flex h-full w-80 flex-col overflow-hidden border-r bg-background">
      {/* Header */}
      {!hideHeader && (
        <div className="flex-shrink-0 border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tools</h2>
              <p className="text-xs text-muted-foreground">
                {actions.length} tool{actions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refetch();
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                className="h-8 w-8"
                title="Refresh actions"
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
              <ActionSyncModal
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
      )}

      {/* Search */}
      <div className="flex-shrink-0 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus={false}
            />
          </div>
          {hideHeader && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refetch();
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                className="h-9 w-9"
                title="Refresh actions"
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
              <ActionSyncModal
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

      {/* Actions List */}
      <ScrollArea
        className="flex-1 w-full overflow-hidden"
        viewportClassName="[&>div]:!w-full [&>div]:overflow-hidden [&>div]:!block"
      >
        <div className="p-2 space-y-1 overflow-hidden">
          {isLoading ? (
            <ActionsSkeleton />
          ) : filteredActions.length === 0 ? (
            <EmptyState
              searchTerm={debouncedSearch}
              hasAnyActions={actions.length > 0}
            />
          ) : (
            Object.entries(groupedActions).map(([type, typeActions]) => {
              if (typeActions.length === 0) return null;

              const actionType = type as ActionType;
              const Icon = ACTION_TYPE_ICON_COMPONENTS[actionType];
              const isExpanded = expandedGroups.has(actionType);

              return (
                <Collapsible
                  key={type}
                  open={isExpanded}
                  onOpenChange={() => toggleGroup(actionType)}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">
                      {ACTION_TYPE_LABELS[actionType]}
                    </span>
                    <span className="text-xs tabular-nums">
                      {typeActions.length}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 space-y-0.5 py-1">
                      {typeActions.map((action) => (
                        <ActionListItem
                          key={action.id}
                          action={action}
                          isSelected={action.id === currentActionId}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Code-First Notice */}
      <div className="flex-shrink-0 border-t p-3">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Tools are defined in code and synced via CI/CD.</span>
        </div>
      </div>
    </div>
  );
}

interface ActionListItemProps {
  action: Action;
  isSelected: boolean;
  onNavigate?: () => void;
}

function ActionListItem({
  action,
  isSelected,
  onNavigate,
}: ActionListItemProps) {
  return (
    <Link
      href={`/tools/${action.id}`}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-3 sm:py-1.5 text-sm transition-colors",
        "hover:bg-muted",
        isSelected && "bg-muted font-medium"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate">{deriveActionLabel(action.name)}</div>
      </div>
      {action.status === "draft" && (
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Draft
        </span>
      )}
      {action.status === "archived" && (
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Archived
        </span>
      )}
    </Link>
  );
}

function ActionsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="ml-4 space-y-1">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex items-center gap-2 px-3 py-1.5">
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  searchTerm,
  hasAnyActions,
}: {
  searchTerm: string;
  hasAnyActions: boolean;
}) {
  if (searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No tools match &quot;{searchTerm}&quot;
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Try a different search term
        </p>
      </div>
    );
  }

  if (!hasAnyActions) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Zap className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="mb-3 text-sm text-muted-foreground">
          No tools synced yet
        </p>
        <p className="text-xs text-muted-foreground/60">
          Define tools in your client code and deploy to sync them.
        </p>
      </div>
    );
  }

  return null;
}
