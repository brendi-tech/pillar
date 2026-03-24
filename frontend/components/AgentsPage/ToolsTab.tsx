"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminFetch } from "@/lib/admin/api-client";
import { mcpSourcesAPI } from "@/lib/admin/mcp-sources-api";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  Server,
  ShieldCheck,
  Unplug,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  Agent,
  AgentOpenAPISourceConfig,
  AgentMCPSourceConfig,
  AgentToolOverrideItem,
} from "@/types/agent";
import { CLIENT_SIDE_CHANNELS } from "@/types/agent";
import type { MCPToolSource } from "@/types/mcpSource";
import type { OpenAPIToolSource } from "@/types/openAPISource";
import {
  mcpSourceListQuery,
  mcpSourceKeys,
  refreshMcpSourceMutation,
} from "@/queries/mcpSource.queries";
import {
  openAPISourceListQuery,
  openAPISourceKeys,
  refreshOpenAPISourceMutation,
} from "@/queries/openAPISource.queries";

interface ToolItem {
  id: string;
  name: string;
  description: string;
  tool_type: string;
  channel_compatibility: string[];
}

interface ToolsTabProps {
  agent: Agent;
  productId: string;
  onChange: (updates: Partial<Agent>) => void;
}

const CHANNELS_WITH_CONTEXT = ["discord", "slack"];

type DisplayMode = "all" | "custom" | "none";

export function ToolsTab({ agent, productId, onChange }: ToolsTabProps) {
  const queryClient = useQueryClient();
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    () => new Set(["client", "server"])
  );
  const { data: tools, isPending: isToolsPending } = useQuery({
    queryKey: ["tools", productId],
    queryFn: () =>
      adminFetch<{ results?: ToolItem[]; length?: number }>(
        `/products/tools/?product=${productId}&page_size=200`
      ).then((res) => (Array.isArray(res) ? res : res.results || [])),
    enabled: !!productId,
  });

  const { data: mcpSources, isPending: isMcpPending } = useQuery(
    mcpSourceListQuery(productId)
  );

  const { data: openAPISources, isPending: isOpenAPIPending } = useQuery(
    openAPISourceListQuery(productId)
  );

  const refreshMutation = useMutation({
    ...refreshMcpSourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpSourceKeys.lists() });
    },
  });

  const refreshOpenAPIMutation = useMutation({
    ...refreshOpenAPISourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.lists() });
    },
  });

  const toggleExpanded = useCallback((sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  if (isToolsPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const allTools = tools || [];
  const supportsClientSide = CLIENT_SIDE_CHANNELS.includes(agent.channel);

  const isChannelCompatible = (t: ToolItem) => {
    if (!supportsClientSide && t.tool_type === "client_side") return false;
    return (
      !t.channel_compatibility?.length ||
      t.channel_compatibility.includes("*") ||
      t.channel_compatibility.includes(agent.channel)
    );
  };

  const compatibleTools = allTools.filter(isChannelCompatible);
  const incompatibleTools = allTools.filter((t) => !isChannelCompatible(t));
  const showContextColumns = CHANNELS_WITH_CONTEXT.includes(agent.channel);
  const restrictions = agent.tool_context_restrictions || {};

  const scope = agent.tool_scope || "all";

  const getEnabledIds = (): Set<string> => {
    if (scope === "all") return new Set(compatibleTools.map((t) => t.id));
    if (scope === "none") return new Set();
    if (scope === "allowed")
      return new Set(agent.tool_allowance_ids || []);
    if (scope === "restricted") {
      const blocked = new Set(agent.tool_restriction_ids || []);
      return new Set(
        compatibleTools.filter((t) => !blocked.has(t.id)).map((t) => t.id)
      );
    }
    if (scope === "all_server_side")
      return new Set(
        compatibleTools
          .filter((t) => t.tool_type === "server_side")
          .map((t) => t.id)
      );
    if (scope === "all_client_side")
      return new Set(
        compatibleTools
          .filter((t) => t.tool_type === "client_side")
          .map((t) => t.id)
      );
    return new Set(compatibleTools.map((t) => t.id));
  };

  const enabledIds = getEnabledIds();

  const isEffectivelyAll =
    enabledIds.size === compatibleTools.length &&
    compatibleTools.every((t) => enabledIds.has(t.id)) &&
    Object.keys(restrictions).length === 0;

  const displayMode: DisplayMode =
    isEffectivelyAll ? "all" : enabledIds.size === 0 ? "none" : "custom";

  const handleModeChange = (mode: DisplayMode) => {
    if (mode === displayMode) return;
    if (mode === "custom" && (displayMode === "all" || displayMode === "none"))
      return;

    if (mode === "all") {
      onChange({
        tool_scope: "all",
        tool_restriction_ids: [],
        tool_allowance_ids: [],
        tool_context_restrictions: {},
      });
    } else if (mode === "none") {
      onChange({
        tool_scope: "none",
        tool_restriction_ids: [],
        tool_allowance_ids: [],
      });
    } else {
      onChange({
        tool_scope: "allowed",
        tool_allowance_ids: [...enabledIds],
        tool_restriction_ids: [],
      });
    }
  };

  const emitNormalized = (
    newIds: string[],
    newRestrictions: Record<string, string[]>
  ) => {
    const allEnabled =
      newIds.length === compatibleTools.length &&
      compatibleTools.every((t) => newIds.includes(t.id));
    const noRestrictions = Object.keys(newRestrictions).length === 0;

    if (allEnabled && noRestrictions) {
      onChange({
        tool_scope: "all",
        tool_allowance_ids: [],
        tool_restriction_ids: [],
        tool_context_restrictions: {},
      });
    } else if (newIds.length === 0) {
      onChange({
        tool_scope: "none",
        tool_allowance_ids: [],
        tool_restriction_ids: [],
      });
    } else {
      onChange({
        tool_scope: "allowed",
        tool_allowance_ids: newIds,
        tool_restriction_ids: [],
      });
    }
  };

  const handleToolToggle = (toolId: string, enabled: boolean) => {
    if (displayMode === "all" && !enabled) {
      const newIds = compatibleTools
        .filter((t) => t.id !== toolId)
        .map((t) => t.id);
      onChange({
        tool_scope: "allowed",
        tool_allowance_ids: newIds,
        tool_restriction_ids: [],
      });
      return;
    }
    if (displayMode === "none" && enabled) {
      onChange({
        tool_scope: "allowed",
        tool_allowance_ids: [toolId],
        tool_restriction_ids: [],
      });
      return;
    }
    const currentIds = [...enabledIds];
    const newIds = enabled
      ? [...currentIds, toolId]
      : currentIds.filter((id) => id !== toolId);
    emitNormalized(newIds, restrictions);
  };

  const isContextChecked = (
    toolName: string,
    context: "private" | "public"
  ) => {
    const allowed = restrictions[toolName];
    if (!allowed) return true;
    return allowed.includes(context);
  };

  const handleContextToggle = (
    toolName: string,
    context: "private" | "public",
    checked: boolean
  ) => {
    const other = context === "private" ? "public" : "private";
    const currentAllowed = restrictions[toolName];
    const otherChecked = currentAllowed
      ? currentAllowed.includes(other)
      : true;

    if (!checked && !otherChecked) return;

    const newRestrictions = { ...restrictions };

    if (checked && (currentAllowed ? currentAllowed.includes(other) : true)) {
      delete newRestrictions[toolName];
    } else if (checked) {
      newRestrictions[toolName] = [context, other];
    } else {
      newRestrictions[toolName] = [other];
    }

    if (
      Object.keys(newRestrictions).length === 0 &&
      enabledIds.size === compatibleTools.length &&
      compatibleTools.every((t) => enabledIds.has(t.id))
    ) {
      onChange({
        tool_scope: "all",
        tool_allowance_ids: [],
        tool_restriction_ids: [],
        tool_context_restrictions: {},
      });
    } else {
      onChange({ tool_context_restrictions: newRestrictions });
    }
  };

  const getMCPConfig = (sourceId: string) =>
    (agent.mcp_sources_config || []).find((c) => c.mcp_source_id === sourceId);

  const updateMCPConfigs = (configs: AgentMCPSourceConfig[]) => {
    onChange({ mcp_sources_config: configs });
  };

  const handleMcpSourceToggle = (sourceId: string, attached: boolean) => {
    const current = agent.mcp_sources_config || [];
    if (attached) {
      updateMCPConfigs([...current, { mcp_source_id: sourceId, tool_overrides: [] }]);
    } else {
      updateMCPConfigs(current.filter((c) => c.mcp_source_id !== sourceId));
    }
  };

  const setMcpOverride = (
    sourceId: string,
    toolName: string,
    field: "is_enabled" | "requires_confirmation",
    value: boolean | null,
  ) => {
    const current = agent.mcp_sources_config || [];
    updateMCPConfigs(
      current.map((c) => {
        if (c.mcp_source_id !== sourceId) return c;
        const overrides = [...(c.tool_overrides || [])];
        const idx = overrides.findIndex((o) => o.tool_name === toolName);

        if (idx >= 0) {
          const updated = { ...overrides[idx], [field]: value };
          if (updated.is_enabled === null && updated.requires_confirmation === null) {
            overrides.splice(idx, 1);
          } else {
            overrides[idx] = updated;
          }
        } else if (value !== null) {
          overrides.push({
            tool_name: toolName,
            is_enabled: field === "is_enabled" ? value : null,
            requires_confirmation: field === "requires_confirmation" ? value : null,
          });
        }

        return { ...c, tool_overrides: overrides };
      }),
    );
  };

  const getOpenAPIConfig = (sourceId: string): AgentOpenAPISourceConfig | undefined =>
    (agent.openapi_sources_config || []).find((c) => c.openapi_source_id === sourceId);

  const updateOpenAPIConfigs = (configs: AgentOpenAPISourceConfig[]) => {
    onChange({ openapi_sources_config: configs });
  };

  const handleOpenAPISourceToggle = (sourceId: string, attached: boolean) => {
    const current = agent.openapi_sources_config || [];
    if (attached) {
      updateOpenAPIConfigs([
        ...current,
        {
          openapi_source_id: sourceId,
          operation_overrides: [],
        },
      ]);
    } else {
      updateOpenAPIConfigs(current.filter((c) => c.openapi_source_id !== sourceId));
    }
  };

  const setOverride = (
    sourceId: string,
    operationId: string,
    field: "is_enabled" | "requires_confirmation",
    value: boolean | null,
  ) => {
    const current = agent.openapi_sources_config || [];
    updateOpenAPIConfigs(
      current.map((c) => {
        if (c.openapi_source_id !== sourceId) return c;
        const overrides = [...(c.operation_overrides || [])];
        const idx = overrides.findIndex((o) => o.tool_name === operationId);

        if (idx >= 0) {
          const updated = { ...overrides[idx], [field]: value };
          if (updated.is_enabled === null && updated.requires_confirmation === null) {
            overrides.splice(idx, 1);
          } else {
            overrides[idx] = updated;
          }
        } else if (value !== null) {
          overrides.push({
            tool_name: operationId,
            is_enabled: field === "is_enabled" ? value : null,
            requires_confirmation: field === "requires_confirmation" ? value : null,
          });
        }

        return { ...c, operation_overrides: overrides };
      }),
    );
  };

  const serverTools = compatibleTools.filter(
    (t) => t.tool_type === "server_side"
  );
  const clientTools = compatibleTools.filter(
    (t) => t.tool_type === "client_side"
  );
  const untypedTools = compatibleTools.filter((t) => !t.tool_type);

  const renderToolRow = (tool: ToolItem) => {
    const isEnabled = enabledIds.has(tool.id);

    return (
      <div
        key={tool.id}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isEnabled ? "hover:bg-muted/50" : "opacity-40"
        )}
      >
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => handleToolToggle(tool.id, !!checked)}
          className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{tool.name}</span>
          {tool.description && (
            <p className="text-xs text-muted-foreground truncate">
              {tool.description}
            </p>
          )}
        </div>
        {showContextColumns && isEnabled ? (
          <div className="flex items-center gap-4 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                checked={isContextChecked(tool.name, "private")}
                onCheckedChange={(checked) =>
                  handleContextToggle(tool.name, "private", !!checked)
                }
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              />
              <span className="text-xs text-muted-foreground">DMs</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                checked={isContextChecked(tool.name, "public")}
                onCheckedChange={(checked) =>
                  handleContextToggle(tool.name, "public", !!checked)
                }
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              />
              <span className="text-xs text-muted-foreground">Public</span>
            </label>
          </div>
        ) : showContextColumns ? (
          <div className="flex items-center gap-4 shrink-0 opacity-30 pointer-events-none">
            <label className="flex items-center gap-1.5">
              <Switch
                checked={false}
                disabled
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
              />
              <span className="text-xs text-muted-foreground">DMs</span>
            </label>
            <label className="flex items-center gap-1.5">
              <Switch
                checked={false}
                disabled
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
              />
              <span className="text-xs text-muted-foreground">Public</span>
            </label>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCollapsibleToolSource = (
    id: string,
    icon: React.ReactNode,
    label: string,
    sectionTools: ToolItem[]
  ) => {
    if (sectionTools.length === 0) return null;
    const isExpanded = expandedSources.has(id);

    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggleExpanded(id)}
      >
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm">
            {icon}
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">
              ({sectionTools.length})
            </span>
          </div>
          {showContextColumns && (
            <div className="flex items-center gap-4 shrink-0 pr-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[68px] text-center">
                DMs
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[68px] text-center">
                Public
              </span>
            </div>
          )}
        </div>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
            {sectionTools.map(renderToolRow)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderMcpSource = (source: MCPToolSource) => {
    const isExpanded = expandedSources.has(source.id);
    const mcpConfig = getMCPConfig(source.id);
    const isAttached = !!mcpConfig;
    const isRefreshing =
      refreshMutation.isPending &&
      refreshMutation.variables === source.id;

    const needsAuth =
      source.auth_type === "oauth" &&
      (source.oauth_status === "authorization_required" ||
        source.oauth_status === "expired");

    const healthDot = needsAuth
      ? "bg-amber-500"
      : source.discovery_status === "success" && source.last_ping_success
        ? "bg-green-500"
        : source.discovery_status === "error"
          ? "bg-red-500"
          : "bg-yellow-500";

    const oauthBadge =
      source.auth_type === "oauth" && source.oauth_status !== "none"
        ? source.oauth_status === "authorized"
          ? { label: "OAuth", variant: "secondary" as const }
          : source.oauth_status === "authorization_required"
            ? { label: "Needs Auth", variant: "destructive" as const }
            : source.oauth_status === "expired"
              ? { label: "Expired", variant: "destructive" as const }
              : source.oauth_status === "discovering"
                ? { label: "Discovering", variant: "outline" as const }
                : source.oauth_status === "error"
                  ? { label: "OAuth Error", variant: "destructive" as const }
                  : null
        : null;

    return (
      <Collapsible
        key={source.id}
        open={isExpanded}
        onOpenChange={() => toggleExpanded(source.id)}
      >
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm min-w-0">
            <Unplug className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium truncate">{source.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {source.tool_count} tool{source.tool_count !== 1 ? "s" : ""}
            </span>
            {oauthBadge && (
              <Badge variant={oauthBadge.variant} className="text-[10px] shrink-0">
                {oauthBadge.label}
              </Badge>
            )}
            <span className={cn("h-2 w-2 rounded-full shrink-0", healthDot)} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {needsAuth && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const url = await mcpSourcesAPI.getOAuthAuthorizeUrl(source.id);
                    window.open(url, "_blank");
                  } catch {
                    // handled by error boundary
                  }
                }}
              >
                <ExternalLink className="h-3 w-3" />
                {source.oauth_status === "expired" ? "Reauthorize" : "Authorize"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                refreshMutation.mutate(source.id);
              }}
              disabled={isRefreshing}
              title="Refresh tools"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  isRefreshing && "animate-spin"
                )}
              />
            </Button>
            <Switch
              checked={isAttached}
              onCheckedChange={(checked) =>
                handleMcpSourceToggle(source.id, !!checked)
              }
              className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              aria-label={isAttached ? "Detach source" : "Attach source"}
            />
          </div>
        </div>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
            {source.last_discovery_at && (
              <p className="text-xs text-muted-foreground px-2 py-0.5">
                Discovered{" "}
                {formatDistanceToNow(new Date(source.last_discovery_at), {
                  addSuffix: true,
                })}
              </p>
            )}
            {source.discovery_status === "error" && source.discovery_error && (
              <p className="text-xs text-red-500 px-2 py-0.5 truncate">
                {source.discovery_error}
              </p>
            )}
            {source.discovered_tools.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-2">
                No tools discovered
              </p>
            ) : (() => {
              const overrideMap = new Map(
                (mcpConfig?.tool_overrides || []).map((o) => [o.tool_name, o]),
              );
              const sourceConfigMap = new Map(
                (source.tool_configs || []).map((c) => [c.tool_name, c]),
              );

              const resolveEnabled = (tn: string): boolean => {
                const ov = overrideMap.get(tn);
                if (ov?.is_enabled !== null && ov?.is_enabled !== undefined) return ov.is_enabled;
                const sc = sourceConfigMap.get(tn);
                return sc?.is_enabled ?? true;
              };

              const resolveConfirmation = (tn: string): boolean => {
                const ov = overrideMap.get(tn);
                if (ov?.requires_confirmation !== null && ov?.requires_confirmation !== undefined)
                  return ov.requires_confirmation;
                const sc = sourceConfigMap.get(tn);
                return sc?.requires_confirmation ?? false;
              };

              const hasConfirmOverride = (tn: string): boolean => {
                const ov = overrideMap.get(tn);
                return ov?.requires_confirmation !== null && ov?.requires_confirmation !== undefined;
              };

              const enabledCount = source.discovered_tools.filter(
                (t) => resolveEnabled(t.name),
              ).length;

              return (
                <>
                  <p className="text-xs text-muted-foreground px-2 py-0.5">
                    {enabledCount}/{source.discovered_tools.length} enabled
                  </p>
                  {source.discovered_tools.map((tool) => {
                    const isToolEnabled = resolveEnabled(tool.name);
                    const confirmState = resolveConfirmation(tool.name);
                    const hasOverride = hasConfirmOverride(tool.name);
                    return (
                      <div
                        key={tool.name}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                      >
                        <Checkbox
                          checked={isToolEnabled}
                          disabled={!isAttached}
                          onCheckedChange={() =>
                            setMcpOverride(
                              source.id,
                              tool.name,
                              "is_enabled",
                              isToolEnabled ? false : null,
                            )
                          }
                          className="h-3.5 w-3.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-sm", !isToolEnabled && "text-muted-foreground line-through")}>
                            {tool.name}
                          </span>
                          {tool.description && (
                            <p className="text-xs text-muted-foreground/60 truncate">
                              {tool.description}
                            </p>
                          )}
                        </div>
                        {isAttached && isToolEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={cn(
                                  "h-5 w-5 rounded flex items-center justify-center text-xs shrink-0",
                                  confirmState
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground",
                                  hasOverride && "ring-1 ring-blue-400",
                                )}
                                onClick={() => {
                                  if (hasOverride) {
                                    setMcpOverride(source.id, tool.name, "requires_confirmation", null);
                                  } else {
                                    setMcpOverride(source.id, tool.name, "requires_confirmation", !confirmState);
                                  }
                                }}
                              >
                                {confirmState ? "!" : "✓"}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs max-w-[200px]">
                              {confirmState
                                ? "Requires confirmation before execution"
                                : "Auto-executes without confirmation"}
                              {hasOverride && " (agent override)"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderOpenAPISource = (source: OpenAPIToolSource) => {
    const isExpanded = expandedSources.has(`openapi-${source.id}`);
    const config = getOpenAPIConfig(source.id);
    const isAttached = !!config;
    const isRefreshing =
      refreshOpenAPIMutation.isPending &&
      refreshOpenAPIMutation.variables === source.id;

    const healthDot =
      source.discovery_status === "success"
        ? "bg-green-500"
        : source.discovery_status === "error"
          ? "bg-red-500"
          : "bg-yellow-500";

    const overrideMap = new Map(
      (config?.operation_overrides || []).map((o) => [o.tool_name, o]),
    );
    const sourceConfigMap = new Map(
      (source.operation_configs || []).map((c) => [c.tool_name, c]),
    );

    const resolveEnabled = (opId: string): boolean => {
      const ov = overrideMap.get(opId);
      if (ov?.is_enabled !== null && ov?.is_enabled !== undefined) return ov.is_enabled;
      const sc = sourceConfigMap.get(opId);
      return sc?.is_enabled ?? true;
    };

    const resolveConfirmation = (opId: string): boolean => {
      const ov = overrideMap.get(opId);
      if (ov?.requires_confirmation !== null && ov?.requires_confirmation !== undefined)
        return ov.requires_confirmation;
      const sc = sourceConfigMap.get(opId);
      return sc?.requires_confirmation ?? false;
    };

    const hasConfirmOverride = (opId: string): boolean => {
      const ov = overrideMap.get(opId);
      return ov?.requires_confirmation !== null && ov?.requires_confirmation !== undefined;
    };

    const enabledCount = source.discovered_operations.filter(
      (op) => resolveEnabled(op.operation_id),
    ).length;
    const hasDisabledOps = enabledCount < source.discovered_operations.length;

    return (
      <Collapsible
        key={source.id}
        open={isExpanded}
        onOpenChange={() => toggleExpanded(`openapi-${source.id}`)}
      >
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm min-w-0">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium truncate">{source.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {isAttached && hasDisabledOps
                ? `${enabledCount}/${source.discovered_operations.length} ops`
                : `${source.operation_count} op${source.operation_count !== 1 ? "s" : ""}`}
            </span>
            <span className={cn("h-2 w-2 rounded-full shrink-0", healthDot)} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                refreshOpenAPIMutation.mutate(source.id);
              }}
              disabled={isRefreshing}
              title="Re-parse spec"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  isRefreshing && "animate-spin"
                )}
              />
            </Button>
            <Switch
              checked={isAttached}
              onCheckedChange={(checked) =>
                handleOpenAPISourceToggle(source.id, !!checked)
              }
              className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              aria-label={isAttached ? "Detach source" : "Attach source"}
            />
          </div>
        </div>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
            {source.last_discovery_at && (
              <p className="text-xs text-muted-foreground px-2 py-0.5">
                Parsed{" "}
                {formatDistanceToNow(new Date(source.last_discovery_at), {
                  addSuffix: true,
                })}
              </p>
            )}
            {source.discovery_status === "error" && source.discovery_error && (
              <p className="text-xs text-red-500 px-2 py-0.5 truncate">
                {source.discovery_error}
              </p>
            )}

            {source.discovered_operations.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-2">
                No operations discovered
              </p>
            ) : (
              <ScrollArea className={source.discovered_operations.length > 12 ? "h-[320px]" : undefined}>
                <div className="space-y-0.5">
                  {source.discovered_operations.map((op) => {
                    const isOpEnabled = resolveEnabled(op.operation_id);
                    const confirmState = resolveConfirmation(op.operation_id);
                    const hasOverride = hasConfirmOverride(op.operation_id);

                    return (
                      <div
                        key={op.operation_id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm group"
                      >
                        {isAttached && (
                          <Checkbox
                            checked={isOpEnabled}
                            onCheckedChange={(checked) =>
                              setOverride(
                                source.id,
                                op.operation_id,
                                "is_enabled",
                                checked ? null : false,
                              )
                            }
                            className="h-3.5 w-3.5 shrink-0"
                          />
                        )}
                        <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground shrink-0 w-10">
                          {op.method}
                        </span>
                        <span className={cn(
                          "text-sm font-mono truncate flex-1",
                          !isOpEnabled
                            ? "text-muted-foreground/40"
                            : "text-muted-foreground",
                        )}>
                          {op.path}
                        </span>
                        {isAttached && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                                    confirmState
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-500/20"
                                      : "bg-muted/50 text-muted-foreground border-transparent opacity-0 group-hover:opacity-100 group-hover:border-border hover:bg-muted hover:text-foreground",
                                    hasOverride && "ring-1 ring-amber-500/30",
                                  )}
                                  onClick={() => {
                                    if (hasOverride) {
                                      setOverride(source.id, op.operation_id, "requires_confirmation", null);
                                    } else {
                                      setOverride(source.id, op.operation_id, "requires_confirmation", !confirmState);
                                    }
                                  }}
                                >
                                  {confirmState ? (
                                    <ShieldCheck className="h-3 w-3" />
                                  ) : (
                                    <Zap className="h-3 w-3" />
                                  )}
                                  {confirmState ? "Confirm" : "Auto"}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-48">
                                {hasOverride
                                  ? "Click to reset to source default"
                                  : confirmState
                                    ? "Confirmation required (source default). Click to override."
                                    : "No confirmation. Click to require confirmation."}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-6">
      {/* Scope selector + counter */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {(["all", "custom", "none"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                displayMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "all" ? "All" : mode === "custom" ? "Custom" : "None"}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {enabledIds.size} of {compatibleTools.length} tools
        </span>
      </div>

      {displayMode === "none" && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This agent has no tools enabled and won&apos;t be able to perform
            any actions.
          </span>
        </div>
      )}

      {displayMode === "custom" && enabledIds.size === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            No tools selected — this agent won&apos;t have access to any tools.
          </span>
        </div>
      )}

      {/* Collapsible source sections */}
      <div className="space-y-0.5">
        {renderCollapsibleToolSource(
          "client",
          <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Client Tools",
          clientTools
        )}
        {renderCollapsibleToolSource(
          "server",
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Server Tools",
          serverTools
        )}
        {renderCollapsibleToolSource(
          "untyped",
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Tools",
          untypedTools
        )}

        {/* MCP Sources */}
        {!isMcpPending &&
          mcpSources?.map((source) => renderMcpSource(source))}
        {isMcpPending && (
          <div className="ml-8 space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {/* OpenAPI Sources */}
        {!isOpenAPIPending &&
          openAPISources?.map((source) => renderOpenAPISource(source))}
        {isOpenAPIPending && (
          <div className="ml-8 space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
          </div>
        )}
      </div>

      {/* Incompatible tools */}
      {incompatibleTools.length > 0 && (
        <TooltipProvider>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incompatible Tools
            </h4>
            <div className="space-y-1 opacity-40">
              {incompatibleTools.map((tool) => {
                const isClientOnly =
                  !supportsClientSide && tool.tool_type === "client_side";

                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-not-allowed">
                        <Switch checked={false} disabled />
                        <span className="text-sm">{tool.name}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] ml-auto shrink-0"
                        >
                          {isClientOnly
                            ? "client-side"
                            : `${tool.channel_compatibility?.join(", ")} only`}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isClientOnly
                        ? "Client-side tool — requires Web Widget or API channel."
                        : `This tool requires ${tool.channel_compatibility?.join(" or ")} and can\u2019t run on ${agent.channel}.`}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
