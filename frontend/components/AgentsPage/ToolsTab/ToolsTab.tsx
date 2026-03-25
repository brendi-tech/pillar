"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminFetch } from "@/lib/admin/api-client";
import { mcpSourcesAPI } from "@/lib/admin/mcp-sources-api";
import {
  ExternalLink,
  Globe,
  Link2,
  Monitor,
  Server,
  Unplug,
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
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

import type { ToolItem, ToolsTabProps } from "./ToolsTab.types";
import { useToolsState } from "./ToolsTab.useToolsState";
import { ToolsHeader } from "./ToolsHeader";
import { ToolSourceSection } from "./ToolSourceSection";
import { ToolRow } from "./ToolRow";

export function ToolsTab({ agent, productId, onChange }: ToolsTabProps) {
  const queryClient = useQueryClient();

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

  const state = useToolsState({
    agent,
    onChange,
    tools: tools || [],
    mcpSources: mcpSources || [],
    openAPISources: openAPISources || [],
  });

  if (isToolsPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const renderSdkToolRow = (tool: ToolItem) => {
    const enabled = state.enabledIds.has(tool.id);
    if (!state.matchesSearch(tool.name, tool.description)) return null;

    const contextControls = state.showContextColumns
      ? {
          dmsChecked: state.isContextChecked(tool.name, "private"),
          publicChecked: state.isContextChecked(tool.name, "public"),
          onDmsToggle: (checked: boolean) =>
            state.handleContextToggle(tool.name, tool.id, "private", checked),
          onPublicToggle: (checked: boolean) =>
            state.handleContextToggle(tool.name, tool.id, "public", checked),
        }
      : null;

    return (
      <ToolRow
        key={tool.id}
        name={tool.name}
        description={tool.description}
        enabled={enabled}
        onToggle={(val) => state.handleToolToggle(tool.id, val)}
        confirmation={
          tool.auto_run !== undefined
            ? { value: !tool.auto_run, readOnly: true }
            : null
        }
        contextControls={contextControls}
      />
    );
  };

  const renderSdkSection = (
    id: string,
    icon: React.ReactNode,
    title: string,
    sectionTools: ToolItem[]
  ) => {
    if (sectionTools.length === 0) return null;
    const filtered = sectionTools.filter((t) =>
      state.matchesSearch(t.name, t.description)
    );
    if (state.searchQuery && filtered.length === 0) return null;

    return (
      <ToolSourceSection
        key={id}
        id={id}
        icon={icon}
        title={title}
        count={sectionTools.length}
        selectionState={state.getSdkSectionSelectionState(sectionTools)}
        onSelectAll={(selectAll) =>
          state.handleSdkSectionSelectAll(sectionTools, selectAll)
        }
        expanded={state.isExpanded(id)}
        onToggleExpanded={() => state.toggleExpanded(id)}
        contextColumnHeaders={state.showContextColumns}
      >
        {sectionTools.map(renderSdkToolRow)}
      </ToolSourceSection>
    );
  };

  const renderMcpSection = (source: (typeof mcpSources extends (infer T)[] | undefined ? T : never)) => {
    if (!source) return null;
    const mcpConfig = state.getMCPConfig(source.id);
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

    const filtered = source.discovered_tools.filter((t) =>
      state.matchesSearch(t.name, t.description)
    );
    if (state.searchQuery && filtered.length === 0) return null;

    const enabledCount = source.discovered_tools.filter((t) =>
      state.resolveMcpEnabled(source, t.name)
    ).length;

    return (
      <ToolSourceSection
        key={source.id}
        id={source.id}
        icon={<Unplug className="h-4 w-4 shrink-0 text-muted-foreground" />}
        title={source.name}
        count={source.discovered_tools.length}
        enabledCount={isAttached ? enabledCount : undefined}
        selectionState={
          isAttached ? state.getMcpSelectionState(source) : "none"
        }
        onSelectAll={(selectAll) =>
          state.handleMcpSectionSelectAll(source, selectAll)
        }
        expanded={state.isExpanded(source.id)}
        onToggleExpanded={() => state.toggleExpanded(source.id)}
        healthDot={healthDot}
        refreshing={isRefreshing}
        onRefresh={() => refreshMutation.mutate(source.id)}
        authAction={
          needsAuth ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const url = await mcpSourcesAPI.getOAuthAuthorizeUrl(
                    source.id
                  );
                  window.open(url, "_blank");
                } catch {
                  // handled by error boundary
                }
              }}
            >
              <ExternalLink className="h-3 w-3" />
              {source.oauth_status === "expired"
                ? "Reauthorize"
                : "Authorize"}
            </Button>
          ) : undefined
        }
      >
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
        ) : (
          source.discovered_tools.map((tool) => {
            if (!state.matchesSearch(tool.name, tool.description))
              return null;
            const isToolEnabled = state.resolveMcpEnabled(
              source,
              tool.name
            );
            const confirmValue = state.resolveMcpConfirmation(
              source,
              tool.name
            );
            const hasOverride = state.hasMcpConfirmOverride(
              source,
              tool.name
            );

            return (
              <ToolRow
                key={tool.name}
                name={tool.name}
                description={tool.description}
                enabled={isToolEnabled}
                onToggle={(val) =>
                  state.setMcpOverride(
                    source.id,
                    tool.name,
                    "is_enabled",
                    val ? null : false
                  )
                }
                disabled={!isAttached}
                confirmation={{
                  value: confirmValue,
                  readOnly: false,
                  hasOverride,
                }}
                onConfirmToggle={() => {
                  if (hasOverride) {
                    state.setMcpOverride(
                      source.id,
                      tool.name,
                      "requires_confirmation",
                      null
                    );
                  } else {
                    state.setMcpOverride(
                      source.id,
                      tool.name,
                      "requires_confirmation",
                      !confirmValue
                    );
                  }
                }}
              />
            );
          })
        )}
      </ToolSourceSection>
    );
  };

  const renderOpenAPISection = (source: (typeof openAPISources extends (infer T)[] | undefined ? T : never)) => {
    if (!source) return null;
    const config = state.getOpenAPIConfig(source.id);
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

    const filtered = source.discovered_operations.filter((op) =>
      state.matchesSearch(op.operation_id, op.summary, op.path)
    );
    if (state.searchQuery && filtered.length === 0) return null;

    const enabledCount = source.discovered_operations.filter((op) =>
      state.resolveOpenAPIEnabled(source, op.operation_id)
    ).length;

    return (
      <ToolSourceSection
        key={`openapi-${source.id}`}
        id={`openapi-${source.id}`}
        icon={<Globe className="h-4 w-4 shrink-0 text-muted-foreground" />}
        title={source.name}
        count={source.discovered_operations.length}
        enabledCount={isAttached ? enabledCount : undefined}
        selectionState={
          isAttached ? state.getOpenAPISelectionState(source) : "none"
        }
        onSelectAll={(selectAll) =>
          state.handleOpenAPISectionSelectAll(source, selectAll)
        }
        expanded={state.isExpanded(`openapi-${source.id}`)}
        onToggleExpanded={() =>
          state.toggleExpanded(`openapi-${source.id}`)
        }
        healthDot={healthDot}
        refreshing={isRefreshing}
        onRefresh={() => refreshOpenAPIMutation.mutate(source.id)}
      >
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
          <ScrollArea
            className={
              source.discovered_operations.length > 12
                ? "h-[320px]"
                : undefined
            }
          >
            <div className="space-y-0.5">
              {source.discovered_operations.map((op) => {
                if (
                  !state.matchesSearch(
                    op.operation_id,
                    op.summary,
                    op.path
                  )
                )
                  return null;
                const isOpEnabled = state.resolveOpenAPIEnabled(
                  source,
                  op.operation_id
                );
                const confirmValue = state.resolveOpenAPIConfirmation(
                  source,
                  op.operation_id
                );
                const hasOverride = state.hasOpenAPIConfirmOverride(
                  source,
                  op.operation_id
                );

                return (
                  <ToolRow
                    key={op.operation_id}
                    name={op.operation_id}
                    description={op.summary}
                    method={op.method}
                    path={op.path}
                    enabled={isOpEnabled}
                    onToggle={(val) =>
                      state.setOpenAPIOverride(
                        source.id,
                        op.operation_id,
                        "is_enabled",
                        val ? null : false
                      )
                    }
                    disabled={!isAttached}
                    confirmation={{
                      value: confirmValue,
                      readOnly: false,
                      hasOverride,
                    }}
                    onConfirmToggle={() => {
                      if (hasOverride) {
                        state.setOpenAPIOverride(
                          source.id,
                          op.operation_id,
                          "requires_confirmation",
                          null
                        );
                      } else {
                        state.setOpenAPIOverride(
                          source.id,
                          op.operation_id,
                          "requires_confirmation",
                          !confirmValue
                        );
                      }
                    }}
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </ToolSourceSection>
    );
  };

  return (
    <div className="space-y-6">
      {state.showIdentityNudge && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <Link2 className="h-4 w-4 shrink-0" />
          <span>
            Some tools require user authentication. Configure auth in each
            tool source&apos;s settings.
          </span>
        </div>
      )}

      <ToolsHeader
        searchQuery={state.searchQuery}
        onSearchChange={state.setSearchQuery}
        enabledCount={state.totalEnabledCount}
        totalCount={state.totalToolCount}
        onEnableAll={state.handleEnableAll}
        onDisableAll={state.handleDisableAll}
        hasNoTools={state.totalEnabledCount === 0}
      />

      <div className="space-y-0.5">
        {renderSdkSection(
          "client",
          <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Client Tools",
          state.clientTools
        )}
        {renderSdkSection(
          "server",
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Server Tools",
          state.serverTools
        )}
        {renderSdkSection(
          "untyped",
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />,
          "Tools",
          state.untypedTools
        )}

        {!isMcpPending &&
          mcpSources?.map((source) => renderMcpSection(source))}
        {isMcpPending && (
          <div className="ml-8 space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isOpenAPIPending &&
          openAPISources?.map((source) => renderOpenAPISection(source))}
        {isOpenAPIPending && (
          <div className="ml-8 space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
          </div>
        )}
      </div>

      {state.incompatibleTools.length > 0 && (
        <TooltipProvider>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incompatible Tools
            </h4>
            <div className="space-y-1 opacity-40">
              {state.incompatibleTools.map((tool) => {
                const isClientOnly =
                  !state.supportsClientSide &&
                  tool.tool_type === "client_side";

                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-not-allowed">
                        <Checkbox checked={false} disabled className="h-4 w-4" />
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
                        ? "Client-side tool \u2014 requires Web Widget or API channel."
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
