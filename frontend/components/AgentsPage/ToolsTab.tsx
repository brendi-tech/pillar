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
import type { Agent } from "@/types/agent";

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
  const compatibleTools = allTools.filter(
    (t) =>
      !t.channel_compatibility?.length ||
      t.channel_compatibility.includes(agent.channel)
  );
  const incompatibleTools = allTools.filter(
    (t) =>
      t.channel_compatibility?.length > 0 &&
      !t.channel_compatibility.includes(agent.channel)
  );

  const useAllTools =
    agent.tool_allowlist.length === 0 && agent.tool_denylist.length === 0;

  const isToolEnabled = (name: string) => {
    if (useAllTools) return true;
    if (agent.tool_allowlist.length > 0)
      return agent.tool_allowlist.includes(name);
    return !agent.tool_denylist.includes(name);
  };

  const handleModeChange = (mode: string) => {
    if (mode === "all") {
      onChange({ tool_allowlist: [], tool_denylist: [] });
    } else {
      const allowlist = compatibleTools.map((t) => t.name);
      onChange({ tool_allowlist: allowlist, tool_denylist: [] });
    }
  };

  const handleToolToggle = (name: string, checked: boolean) => {
    if (useAllTools) {
      if (!checked) {
        onChange({ tool_denylist: [name] });
      }
      return;
    }

    if (agent.tool_allowlist.length > 0) {
      const newAllowlist = checked
        ? [...agent.tool_allowlist, name]
        : agent.tool_allowlist.filter((n) => n !== name);
      onChange({ tool_allowlist: newAllowlist });
    } else {
      const newDenylist = checked
        ? agent.tool_denylist.filter((n) => n !== name)
        : [...agent.tool_denylist, name];
      onChange({ tool_denylist: newDenylist });
    }
  };

  return (
    <div className="space-y-6">
      <RadioGroup
        value={useAllTools ? "all" : "selected"}
        onValueChange={handleModeChange}
        className="gap-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="tools-all" />
          <Label htmlFor="tools-all" className="cursor-pointer text-sm">
            All compatible tools ({compatibleTools.length} of {allTools.length})
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="selected" id="tools-selected" />
          <Label htmlFor="tools-selected" className="cursor-pointer text-sm">
            Selected tools only
          </Label>
        </div>
      </RadioGroup>

      {compatibleTools.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Compatible Tools
          </h4>
          <div className="space-y-1">
            {compatibleTools.map((tool) => (
              <label
                key={tool.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={isToolEnabled(tool.name)}
                  onCheckedChange={(checked) =>
                    handleToolToggle(tool.name, !!checked)
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
