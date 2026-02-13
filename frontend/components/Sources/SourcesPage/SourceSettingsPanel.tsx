"use client";

import { DocumentUploadZone } from "@/components/KnowledgePageContent/DocumentUploadZone";
import type { MetadataItem } from "@/components/shared";
import {
  DetailHeader,
  DetailPageShell,
  MetadataStrip,
  SectionLabel,
  TimestampFooter,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WarningModal } from "@/components/WarningModal";
import { useWebSocketEvent } from "@/hooks/use-websocket-event";
import { cn } from "@/lib/utils";
import { useSources } from "@/providers";
import { knowledgeKeys } from "@/queries/knowledge.queries";
import {
  deleteKnowledgeSourceMutation,
  knowledgeSourceKeys,
  knowledgeSourceSyncHistoryQuery,
  triggerKnowledgeSourceSyncMutation,
} from "@/queries/sources.queries";
import type { KnowledgeSourceType } from "@/types/sources";
import { KNOWLEDGE_SOURCE_TYPE_LABELS } from "@/types/sources";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  BookOpen,
  Check,
  Clock,
  Cloud,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SourceEditPanel } from "./SourceEditPanel";

// =============================================================================
// Types
// =============================================================================

interface SourceSettingsPanelProps {
  sourceId: string;
  onDeleted?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function SourceTypeIcon({
  type,
  className,
}: {
  type: KnowledgeSourceType;
  className?: string;
}) {
  switch (type) {
    case "help_center":
      return <BookOpen className={className} />;
    case "marketing_site":
    case "website_crawl":
      return <Globe className={className} />;
    case "cloud_storage":
      return <Cloud className={className} />;
    case "document_upload":
      return <Upload className={className} />;
    case "snippets":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function getSyncStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
        >
          <Check className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
        >
          <X className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
        >
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
        >
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function SourceSettingsPanel({
  sourceId,
  onDeleted,
}: SourceSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // ── Shared data from SourcesProvider (same cache as sidebar) ──
  const { getSourceById, isLoading: isSourcesLoading, refresh } = useSources();
  const source = getSourceById(sourceId);

  // ── Sync history (separate query, not in list response) ──
  const { data: syncHistory = [] } = useQuery({
    ...knowledgeSourceSyncHistoryQuery(sourceId),
    enabled: !!sourceId,
  });

  // Refresh sync history when sync completes or fails (via WebSocket)
  useWebSocketEvent(
    "websocket:source.sync_completed",
    useCallback(
      (event: CustomEvent) => {
        if (event.detail?.source_id === sourceId) {
          queryClient.invalidateQueries({
            queryKey: knowledgeSourceKeys.syncHistory(sourceId),
          });
        }
      },
      [sourceId, queryClient]
    )
  );

  useWebSocketEvent(
    "websocket:source.sync_failed",
    useCallback(
      (event: CustomEvent) => {
        if (event.detail?.source_id === sourceId) {
          queryClient.invalidateQueries({
            queryKey: knowledgeSourceKeys.syncHistory(sourceId),
          });
        }
      },
      [sourceId, queryClient]
    )
  );

  // ── Mutations ──
  const syncMutation = useMutation({
    ...triggerKnowledgeSourceSyncMutation(),
    onSuccess: () => {
      toast.success("Sync started", {
        description: "Content sync has been triggered.",
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeSourceKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeSourceKeys.syncHistory(sourceId),
      });
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to start sync";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    ...deleteKnowledgeSourceMutation(),
    onSuccess: () => {
      toast.success("Source deleted");
      queryClient.invalidateQueries({
        queryKey: knowledgeSourceKeys.lists(),
      });
      onDeleted?.();
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Failed to delete source";
      toast.error(message);
    },
  });

  const handleSync = useCallback(() => {
    syncMutation.mutate({
      id: sourceId,
      restart: source?.status === "syncing",
    });
  }, [sourceId, source?.status, syncMutation]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(sourceId);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }, [sourceId, deleteMutation]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditComplete = useCallback(() => {
    setIsEditing(false);
    refresh();
  }, [refresh]);

  // ── Edit mode ──
  if (isEditing && source) {
    return (
      <SourceEditPanel
        source={source}
        onCancel={handleEditComplete}
        onSaved={handleEditComplete}
      />
    );
  }

  const canSync =
    source?.source_type !== "snippets" &&
    source?.source_type !== "document_upload";

  // Build metadata items for the strip
  const metadataItems: MetadataItem[] = [];
  if (source) {
    metadataItems.push({
      label:
        source.source_type === "snippets"
          ? "Snippets"
          : source.source_type === "document_upload"
            ? "Documents"
            : "Items (Indexed / Crawled)",
      value: (
        <span className="font-semibold tabular-nums">
          {canSync
            ? `${source.pages_indexed.toLocaleString()} / ${source.item_count.toLocaleString()}`
            : source.item_count.toLocaleString()}
        </span>
      ),
    });

    metadataItems.push({
      label: canSync ? "Last Synced" : "Created",
      value: canSync
        ? source.last_synced_at
          ? formatDistanceToNow(new Date(source.last_synced_at), {
              addSuffix: true,
            })
          : "Never"
        : format(new Date(source.created_at), "MMM d, yyyy"),
    });

    if (source.url) {
      metadataItems.push({
        label: "URL",
        value: (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
          >
            {source.url}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ),
        colSpan: 2,
      });
    }
  }

  return (
    <DetailPageShell
      isLoading={isSourcesLoading}
      isEmpty={!source && !isSourcesLoading}
      emptyTitle="Source not found"
      emptyDescription="This knowledge source may have been deleted."
    >
      {source && (
        <>
          {/* ── Header ── */}
          <DetailHeader
            icon={
              <SourceTypeIcon
                type={source.source_type}
                className="h-5 w-5 text-muted-foreground"
              />
            }
            title={source.name}
            subtitle={KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
            badges={
              <>
                <Badge
                  variant="outline"
                  className={cn(
                    source.status === "active" &&
                      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
                    source.status === "syncing" &&
                      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
                    source.status === "error" &&
                      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
                    source.status === "paused" &&
                      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                  )}
                >
                  {source.status === "syncing" && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {source.status}
                </Badge>

                <Badge variant="outline" className="gap-1.5">
                  <SourceTypeIcon
                    type={source.source_type}
                    className="h-3 w-3"
                  />
                  {KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
                </Badge>

                {canSync && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={handleSync}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {source.status === "syncing" ? "Restart Sync" : "Sync Now"}
                  </Button>
                )}
              </>
            }
            actions={
              <>
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            }
          />

          {/* ── Error Banner ── */}
          {source.error_message && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Sync Error
                </p>
                <p className="max-w-prose text-sm text-red-700 dark:text-red-300 mt-0.5">
                  {source.error_message}
                </p>
              </div>
            </div>
          )}

          {/* ── Source Details (metadata strip) ── */}
          <MetadataStrip items={metadataItems} />

          {/* ── Crawl Configuration ── */}
          {source.crawl_config &&
            Object.keys(source.crawl_config).length > 0 && (
              <div>
                <SectionLabel className="mb-2">
                  Crawl Configuration
                </SectionLabel>
                <div className="space-y-1.5 text-sm">
                  {source.crawl_config.max_pages && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Pages</span>
                      <span className="font-medium tabular-nums">
                        {source.crawl_config.max_pages.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {source.crawl_config.include_paths &&
                    source.crawl_config.include_paths.length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">
                          Include Paths
                        </span>
                        <span className="font-medium text-right truncate">
                          {source.crawl_config.include_paths.join(", ")}
                        </span>
                      </div>
                    )}
                  {source.crawl_config.exclude_paths &&
                    source.crawl_config.exclude_paths.length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">
                          Exclude Paths
                        </span>
                        <span className="font-medium text-right truncate">
                          {source.crawl_config.exclude_paths.join(", ")}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

          {/* ── Upload Documents (for document_upload sources) ── */}
          {source.source_type === "document_upload" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Upload Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentUploadZone
                  sourceId={sourceId}
                  onUploadComplete={() => {
                    refresh();
                    queryClient.invalidateQueries({
                      queryKey: knowledgeKeys.items(),
                    });
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* ── Sync History ── */}
          {canSync && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Recent Sync History</CardTitle>
                <CardDescription>
                  Last {Math.min(syncHistory.length, 5)} sync operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sync history yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncHistory.slice(0, 5).map((sync) => (
                      <div key={sync.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            {getSyncStatusBadge(sync.status)}
                            <div>
                              <p className="text-sm font-medium">
                                {sync.sync_type === "full"
                                  ? "Full Sync"
                                  : "Incremental Sync"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sync.started_at || sync.created_at
                                  ? format(
                                      new Date(
                                        sync.started_at || sync.created_at
                                      ),
                                      "MMM d, yyyy h:mm a"
                                    )
                                  : "\u2014"}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm sm:text-right">
                            {sync.status === "completed" && (
                              <p className="text-muted-foreground tabular-nums">
                                {sync.items_created} created,{" "}
                                {sync.items_updated} updated
                              </p>
                            )}
                            {sync.status === "failed" && sync.error_message && (
                              <p
                                className="text-red-600 dark:text-red-400 text-xs truncate sm:max-w-xs"
                                title={sync.error_message}
                              >
                                {sync.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Timestamps footer ── */}
          <TimestampFooter
            createdAt={source.created_at}
            updatedAt={source.updated_at}
          />

          {/* Delete Confirmation Modal */}
          <WarningModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            onConfirm={handleDeleteConfirm}
            title="Delete Knowledge Source"
            description={
              <>
                Are you sure you want to delete <strong>{source.name}</strong>?
                This action cannot be undone. All indexed content will be
                removed.
              </>
            }
            variant="delete"
            isLoading={isDeleting}
          />
        </>
      )}
    </DetailPageShell>
  );
}
