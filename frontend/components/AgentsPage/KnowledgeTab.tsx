"use client";

import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { knowledgeSourceListQuery } from "@/queries/knowledge.queries";
import type { Agent, KnowledgeScopeMode } from "@/types/agent";
import type { KnowledgeSource, KnowledgeSourceVisibility } from "@/types/knowledge";
import {
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_VISIBILITY_LABELS,
} from "@/types/knowledge";
import { AlertTriangle } from "lucide-react";

interface KnowledgeTabProps {
  agent: Agent;
  productId: string;
  onChange: (updates: Partial<Agent>) => void;
}

const VISIBILITY_BADGE_VARIANT: Record<KnowledgeSourceVisibility, "default" | "secondary" | "outline"> = {
  internal: "secondary",
  external: "default",
  all: "outline",
};

export function KnowledgeTab({ agent, productId, onChange }: KnowledgeTabProps) {
  const { data: sourcesResponse, isPending } = useQuery(
    knowledgeSourceListQuery({ product: productId })
  );

  const sources: KnowledgeSource[] = Array.isArray(sourcesResponse)
    ? sourcesResponse
    : sourcesResponse?.results || [];

  const scope = agent.knowledge_scope || "all";
  const selectedIds = agent.knowledge_source_ids || [];

  const handleScopeChange = (value: string) => {
    const newScope = value as KnowledgeScopeMode;
    onChange({
      knowledge_scope: newScope,
      knowledge_source_ids: newScope === "selected" ? selectedIds : [],
    });
  };

  const handleSourceToggle = (sourceId: string, checked: boolean) => {
    const newIds = checked
      ? [...selectedIds, sourceId]
      : selectedIds.filter((id) => id !== sourceId);
    onChange({ knowledge_source_ids: newIds });
  };

  const getAccessibleCount = (): number => {
    if (scope === "all") return sources.length;
    if (scope === "all_internal")
      return sources.filter((s) => s.visibility === "internal" || s.visibility === "all").length;
    if (scope === "all_external")
      return sources.filter((s) => s.visibility === "external" || s.visibility === "all").length;
    if (scope === "selected") return selectedIds.length;
    return sources.length;
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-1">Knowledge Scope</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Control which knowledge sources this agent can search.
        </p>

        <RadioGroup
          value={scope}
          onValueChange={handleScopeChange}
          className="gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="scope-all" />
            <Label htmlFor="scope-all" className="cursor-pointer text-sm">
              All sources ({sources.length})
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all_internal" id="scope-internal" />
            <Label htmlFor="scope-internal" className="cursor-pointer text-sm">
              All internal sources (
              {sources.filter((s) => s.visibility === "internal" || s.visibility === "all").length})
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all_external" id="scope-external" />
            <Label htmlFor="scope-external" className="cursor-pointer text-sm">
              All external sources (
              {sources.filter((s) => s.visibility === "external" || s.visibility === "all").length})
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="selected" id="scope-selected" />
            <Label htmlFor="scope-selected" className="cursor-pointer text-sm">
              Selected sources only
            </Label>
          </div>
        </RadioGroup>
      </div>

      <p className="text-xs text-muted-foreground">
        This agent can access {getAccessibleCount()} of {sources.length} knowledge
        source{sources.length !== 1 ? "s" : ""}.
      </p>

      {scope === "selected" && (
        <div className="space-y-2">
          {selectedIds.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                No sources selected — this agent won&apos;t have access to any
                knowledge.
              </span>
            </div>
          )}

          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Select Sources
          </h4>
          <div className="space-y-1">
            {sources.map((source) => (
              <label
                key={source.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedIds.includes(source.id)}
                  onCheckedChange={(checked) =>
                    handleSourceToggle(source.id, !!checked)
                  }
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{source.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]} &middot;{" "}
                    {source.item_count} item{source.item_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge
                  variant={VISIBILITY_BADGE_VARIANT[source.visibility || "all"]}
                  className="text-[10px] shrink-0"
                >
                  {KNOWLEDGE_VISIBILITY_LABELS[source.visibility || "all"]}
                </Badge>
              </label>
            ))}
          </div>

          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No knowledge sources configured for this product.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
