"use client";

import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminFetch } from "@/lib/admin/api-client";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent";
import { CLIENT_SIDE_CHANNELS } from "@/types/agent";

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
  const { data: tools, isPending } = useQuery({
    queryKey: ["tools", productId],
    queryFn: () =>
      adminFetch<{ results?: ToolItem[]; length?: number }>(
        `/products/tools/?product=${productId}&page_size=200`
      ).then((res) => (Array.isArray(res) ? res : res.results || [])),
    enabled: !!productId,
  });

  if (isPending) {
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
      return new Set(compatibleTools.filter((t) => !blocked.has(t.id)).map((t) => t.id));
    }
    if (scope === "all_server_side")
      return new Set(compatibleTools.filter((t) => t.tool_type === "server_side").map((t) => t.id));
    if (scope === "all_client_side")
      return new Set(compatibleTools.filter((t) => t.tool_type === "client_side").map((t) => t.id));
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
    if (mode === "custom" && (displayMode === "all" || displayMode === "none")) return;

    if (mode === "all") {
      onChange({ tool_scope: "all", tool_restriction_ids: [], tool_allowance_ids: [], tool_context_restrictions: {} });
    } else if (mode === "none") {
      onChange({ tool_scope: "none", tool_restriction_ids: [], tool_allowance_ids: [] });
    } else {
      onChange({ tool_scope: "allowed", tool_allowance_ids: [...enabledIds], tool_restriction_ids: [] });
    }
  };

  const emitNormalized = (newIds: string[], newRestrictions: Record<string, string[]>) => {
    const allEnabled =
      newIds.length === compatibleTools.length &&
      compatibleTools.every((t) => newIds.includes(t.id));
    const noRestrictions = Object.keys(newRestrictions).length === 0;

    if (allEnabled && noRestrictions) {
      onChange({ tool_scope: "all", tool_allowance_ids: [], tool_restriction_ids: [], tool_context_restrictions: {} });
    } else if (newIds.length === 0) {
      onChange({ tool_scope: "none", tool_allowance_ids: [], tool_restriction_ids: [] });
    } else {
      onChange({ tool_scope: "allowed", tool_allowance_ids: newIds, tool_restriction_ids: [] });
    }
  };

  const handleToolToggle = (toolId: string, enabled: boolean) => {
    if (displayMode === "all" && !enabled) {
      const newIds = compatibleTools.filter((t) => t.id !== toolId).map((t) => t.id);
      onChange({ tool_scope: "allowed", tool_allowance_ids: newIds, tool_restriction_ids: [] });
      return;
    }
    if (displayMode === "none" && enabled) {
      onChange({ tool_scope: "allowed", tool_allowance_ids: [toolId], tool_restriction_ids: [] });
      return;
    }
    const currentIds = [...enabledIds];
    const newIds = enabled
      ? [...currentIds, toolId]
      : currentIds.filter((id) => id !== toolId);
    emitNormalized(newIds, restrictions);
  };

  const isContextChecked = (toolName: string, context: "private" | "public") => {
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
    const otherChecked = currentAllowed ? currentAllowed.includes(other) : true;

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
      onChange({ tool_scope: "all", tool_allowance_ids: [], tool_restriction_ids: [], tool_context_restrictions: {} });
    } else {
      onChange({ tool_context_restrictions: newRestrictions });
    }
  };

  const serverTools = compatibleTools.filter((t) => t.tool_type === "server_side");
  const clientTools = compatibleTools.filter((t) => t.tool_type === "client_side");
  const untypedTools = compatibleTools.filter((t) => !t.tool_type);

  const renderToolRow = (tool: ToolItem) => {
    const isEnabled = enabledIds.has(tool.id);

    return (
      <div
        key={tool.id}
        className={cn(
          "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
          isEnabled ? "hover:bg-muted/50" : "opacity-40"
        )}
      >
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => handleToolToggle(tool.id, !!checked)}
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

  const renderToolSection = (title: string, sectionTools: ToolItem[]) => {
    if (sectionTools.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </h4>
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
        <div className="space-y-1">{sectionTools.map(renderToolRow)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Mode selector + counter */}
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

      {/* Tool list grouped by type */}
      {renderToolSection("Server-side tools", serverTools)}
      {renderToolSection("Client-side tools", clientTools)}
      {renderToolSection("Tools", untypedTools)}

      {/* Incompatible tools */}
      {incompatibleTools.length > 0 && (
        <TooltipProvider>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incompatible Tools
            </h4>
            <div className="space-y-1 opacity-40">
              {incompatibleTools.map((tool) => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-not-allowed">
                      <Switch checked={false} disabled />
                      <span className="text-sm">{tool.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] ml-auto shrink-0"
                      >
                        {tool.channel_compatibility?.join(", ")} only
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    This tool requires{" "}
                    {tool.channel_compatibility?.join(" or ")} and can&apos;t run
                    on {agent.channel}.
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
