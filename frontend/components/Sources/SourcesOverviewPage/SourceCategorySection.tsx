"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSource, triggerSync } from "@/lib/admin/sources-api";
import { useSources } from "@/providers";
import type { KnowledgeSourceConfig } from "@/types/sources";
import { KNOWLEDGE_SOURCE_TYPE_LABELS } from "@/types/sources";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, type ComponentType } from "react";
import { toast } from "sonner";

interface SourceCategorySectionProps {
  id: string;
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  sources: KnowledgeSourceConfig[];
}

export function SourceCategorySection({
  id,
  title,
  description,
  icon: Icon,
  sources,
}: SourceCategorySectionProps) {
  const { refresh } = useSources();

  const handleSync = useCallback(
    async (source: KnowledgeSourceConfig) => {
      try {
        await triggerSync(source.id);
        toast.success(`Sync started for ${source.name}`);
        setTimeout(() => refresh(), 1000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start sync";
        toast.error(`Failed to sync ${source.name}`, { description: message });
      }
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (source: KnowledgeSourceConfig) => {
      if (
        !confirm(
          `Are you sure you want to delete "${source.name}"? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteSource(source.id);
        toast.success(`Deleted ${source.name}`);
        refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete source";
        toast.error(`Failed to delete ${source.name}`, {
          description: message,
        });
      }
    },
    [refresh]
  );

  if (sources.length === 0) {
    return (
      <section data-section-id={id} className="py-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            No {title.toLowerCase()} connected yet
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge/new" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section data-section-id={id} className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {sources.length} source{sources.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            onSync={() => handleSync(source)}
            onDelete={() => handleDelete(source)}
          />
        ))}
      </div>
    </section>
  );
}

interface SourceRowProps {
  source: KnowledgeSourceConfig;
  onSync: () => void;
  onDelete: () => void;
}

function SourceRow({ source, onSync, onDelete }: SourceRowProps) {
  const canSync = source.source_type !== 'snippets';
  const isSyncing = source.status === 'syncing';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <Link
        href={`/knowledge/${source.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium truncate">{source.name}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span>{KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}</span>
              <span>·</span>
              <span>{source.item_count} items</span>
              {source.url && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 truncate">
                    {source.url}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Badge
          variant="outline"
          className={cn(
            source.status === "active" &&
              "bg-green-50 text-green-700 border-green-200",
            source.status === "syncing" &&
              "bg-blue-50 text-blue-700 border-blue-200",
            source.status === "error" &&
              "bg-red-50 text-red-700 border-red-200",
            source.status === "paused" &&
              "bg-yellow-50 text-yellow-700 border-yellow-200"
          )}
        >
          {isSyncing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {source.status}
        </Badge>

        {canSync && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.preventDefault();
              onSync();
            }}
            disabled={isSyncing}
            title="Sync now"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          title="Delete source"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
