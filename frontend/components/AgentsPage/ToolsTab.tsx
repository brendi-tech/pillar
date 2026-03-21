"use client";

import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { adminFetch } from "@/lib/admin/api-client";
import { AlertTriangle } from "lucide-react";
import type { Agent, ToolScopeMode } from "@/types/agent";
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

  const serverSideCount = allTools.filter(
    (t) => t.tool_type === "server_side"
  ).length;
  const clientSideCount = allTools.filter(
    (t) => t.tool_type === "client_side"
  ).length;

  const scope = agent.tool_scope || "all";
  const restrictionIds = agent.tool_restriction_ids || [];
  const allowanceIds = agent.tool_allowance_ids || [];
  const showChecklist = scope === "restricted" || scope === "allowed";

  const compatibleServerSideCount = compatibleTools.filter(
    (t) => t.tool_type === "server_side"
  ).length;
  const compatibleClientSideCount = compatibleTools.filter(
    (t) => t.tool_type === "client_side"
  ).length;

  const getAccessibleCount = (): number => {
    if (scope === "all") return compatibleTools.length;
    if (scope === "all_server_side") return compatibleServerSideCount;
    if (scope === "all_client_side") return compatibleClientSideCount;
    if (scope === "restricted")
      return compatibleTools.length - restrictionIds.length;
    if (scope === "allowed") return allowanceIds.length;
    return 0;
  };

  const isToolChecked = (toolId: string): boolean => {
    if (scope === "restricted") return !restrictionIds.includes(toolId);
    if (scope === "allowed") return allowanceIds.includes(toolId);
    return true;
  };

  const handleScopeChange = (value: string) => {
    const newScope = value as ToolScopeMode;
    onChange({
      tool_scope: newScope,
      tool_restriction_ids: [],
      tool_allowance_ids: [],
    });
  };

  const handleToolToggle = (toolId: string, checked: boolean) => {
    if (scope === "restricted") {
      const newIds = checked
        ? restrictionIds.filter((id) => id !== toolId)
        : [...restrictionIds, toolId];
      onChange({ tool_restriction_ids: newIds });
    } else if (scope === "allowed") {
      const newIds = checked
        ? [...allowanceIds, toolId]
        : allowanceIds.filter((id) => id !== toolId);
      onChange({ tool_allowance_ids: newIds });
    }
  };

  const handleSelectAll = () => {
    if (scope === "restricted") {
      onChange({ tool_restriction_ids: [] });
    } else if (scope === "allowed") {
      onChange({
        tool_allowance_ids: compatibleTools.map((t) => t.id),
      });
    }
  };

  const handleDeselectAll = () => {
    if (scope === "restricted") {
      onChange({
        tool_restriction_ids: compatibleTools.map((t) => t.id),
      });
    } else if (scope === "allowed") {
      onChange({ tool_allowance_ids: [] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-1">Tool Scope</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Control which tools this agent can use.
        </p>

        <RadioGroup
          value={scope}
          onValueChange={handleScopeChange}
          className="gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="scope-all" />
            <Label htmlFor="scope-all" className="cursor-pointer text-sm">
              All tools (
              {compatibleTools.length === allTools.length
                ? compatibleTools.length
                : `${compatibleTools.length} of ${allTools.length}`}
              )
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all_server_side" id="scope-server" />
            <Label htmlFor="scope-server" className="cursor-pointer text-sm">
              All server-side ({serverSideCount})
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="all_client_side"
              id="scope-client"
              disabled={!supportsClientSide}
            />
            <Label
              htmlFor="scope-client"
              className={
                supportsClientSide
                  ? "cursor-pointer text-sm"
                  : "cursor-not-allowed text-sm text-muted-foreground"
              }
            >
              All client-side ({clientSideCount})
              {!supportsClientSide && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  — web &amp; API only
                </span>
              )}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="restricted" id="scope-restricted" />
            <Label
              htmlFor="scope-restricted"
              className="cursor-pointer text-sm"
            >
              All with restrictions
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="allowed" id="scope-allowed" />
            <Label htmlFor="scope-allowed" className="cursor-pointer text-sm">
              Allowed only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="scope-none" />
            <Label htmlFor="scope-none" className="cursor-pointer text-sm">
              No tools
            </Label>
          </div>
        </RadioGroup>
      </div>

      <p className="text-xs text-muted-foreground">
        {scope === "all" &&
          `This agent can access all ${compatibleTools.length} compatible tools${compatibleTools.length < allTools.length ? ` of ${allTools.length} total` : ""}, including any new compatible tools added in the future.`}
        {scope === "all_server_side" &&
          `This agent can access ${compatibleServerSideCount} server-side tools, including any new server-side tools added in the future.`}
        {scope === "all_client_side" &&
          `This agent can access ${compatibleClientSideCount} client-side tools, including any new client-side tools added in the future.`}
        {scope === "restricted" &&
          `This agent can access ${getAccessibleCount()} of ${compatibleTools.length} tools. New tools will be automatically included unless explicitly restricted.`}
        {scope === "allowed" &&
          `This agent can access ${allowanceIds.length} of ${compatibleTools.length} tools. New tools will not be included until explicitly allowed.`}
        {scope === "none" &&
          `This agent has no access to any tools.`}
      </p>

      {scope === "none" && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This agent has no tools enabled and won&apos;t be able to perform
            any actions.
          </span>
        </div>
      )}

      {scope === "allowed" && allowanceIds.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            No tools selected — this agent won&apos;t have access to any tools.
          </span>
        </div>
      )}

      {showChecklist && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {scope === "restricted" ? "Restrict Tools" : "Select Tools"}
            </h4>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Select all
              </button>
              <span className="text-muted-foreground">&middot;</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {compatibleTools.map((tool) => (
              <label
                key={tool.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={isToolChecked(tool.id)}
                  onCheckedChange={(checked) =>
                    handleToolToggle(tool.id, !!checked)
                  }
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{tool.name}</span>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {tool.description}
                    </p>
                  )}
                </div>
                {tool.tool_type && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {tool.tool_type}
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {incompatibleTools.length > 0 && (
        <TooltipProvider>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incompatible Tools
            </h4>
            <div className="space-y-1 opacity-50">
              {incompatibleTools.map((tool) => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-not-allowed">
                      <Checkbox checked={false} disabled />
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
