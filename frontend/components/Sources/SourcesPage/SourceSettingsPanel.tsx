"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { WarningModal } from "@/components/WarningModal";
import { cn } from "@/lib/utils";
import {
  deleteKnowledgeSourceMutation,
  knowledgeSourceDetailQuery,
  knowledgeSourceKeys,
  knowledgeSourceSyncHistoryQuery,
  triggerKnowledgeSourceSyncMutation,
} from "@/queries/sources.queries";
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
import type { KnowledgeSourceConfig, KnowledgeSourceType } from "@/types/sources";
import { KNOWLEDGE_SOURCE_TYPE_LABELS } from "@/types/sources";
import { SourceEditPanel } from "./SourceEditPanel";
import { DocumentUploadZone } from "@/components/KnowledgePageContent/DocumentUploadZone";
import { knowledgeKeys } from "@/queries/knowledge.queries";

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

function SourceTypeIcon({ type, className }: { type: KnowledgeSourceType; className?: string }) {
  switch (type) {
    case 'help_center':
      return <BookOpen className={className} />;
    case 'marketing_site':
    case 'website_crawl':
      return <Globe className={className} />;
    case 'cloud_storage':
      return <Cloud className={className} />;
    case 'document_upload':
      return <Upload className={className} />;
    case 'snippets':
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
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

  // Fetch source details with conditional polling while syncing
  const {
    data: source,
    isPending: isSourceLoading,
    error: sourceError,
  } = useQuery({
    ...knowledgeSourceDetailQuery(sourceId),
    // Poll every 3s while syncing to show live item counts
    refetchInterval: (query) => {
      const source = query.state.data;
      return source?.status === "syncing" ? 3000 : false;
    },
  });

  // Fetch sync history with conditional polling while syncing
  const { data: syncHistory = [] } = useQuery({
    ...knowledgeSourceSyncHistoryQuery(sourceId),
    enabled: !!sourceId,
    // Poll every 3s while syncing to show progress
    refetchInterval: (query) => {
      // Poll if the source is syncing (check from parent query)
      return source?.status === "syncing" ? 3000 : false;
    },
  });

  // Mutations
  const syncMutation = useMutation({
    ...triggerKnowledgeSourceSyncMutation(),
    onSuccess: () => {
      toast.success("Sync started", {
        description: "Content sync has been triggered.",
      });
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.detail(sourceId) });
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
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
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
  }, []);

  if (isSourceLoading) {
    return <SettingsPanelSkeleton />;
  }

  if (sourceError || !source) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/60 mb-4" />
        <p className="text-sm text-muted-foreground">Failed to load source</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {sourceError instanceof Error ? sourceError.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <Check className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            <X className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "running":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Check if this source can be synced (snippets and document_upload can't be synced)
  const canSync = source.source_type !== 'snippets' && source.source_type !== 'document_upload';

  // Show edit panel when editing
  if (isEditing) {
    return (
      <SourceEditPanel
        source={source}
        onCancel={handleEditComplete}
        onSaved={handleEditComplete}
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <SourceTypeIcon type={source.source_type} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">{source.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </div>

        {/* Error Banner */}
        {source.error_message && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Sync Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {source.error_message}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {canSync && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {source.status === "syncing"
                ? "Stop & sync again"
                : "Sync Now"}
            </Button>
          </div>
        )}

        {/* Source Details */}
        <Card>
          <CardHeader>
            <CardTitle>Source Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">
                  {KNOWLEDGE_SOURCE_TYPE_LABELS[source.source_type]}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">
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
                    {source.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {source.source_type === 'snippets'
                    ? 'Snippets'
                    : source.source_type === 'document_upload'
                    ? 'Documents'
                    : 'Items (Indexed / Crawled)'}
                </p>
                <p className="font-medium">
                  {canSync
                    ? `${source.pages_indexed} / ${source.item_count}`
                    : source.item_count}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {canSync ? 'Last Synced' : 'Created'}
                </p>
                <p className="font-medium">
                  {canSync
                    ? source.last_synced_at
                      ? formatDistanceToNow(new Date(source.last_synced_at), {
                          addSuffix: true,
                        })
                      : "Never"
                    : format(new Date(source.created_at), "MMM d, yyyy")}
                </p>
              </div>
              {source.url && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">URL</p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {source.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Documents (for document_upload sources) */}
        {source.source_type === 'document_upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUploadZone
                sourceId={sourceId}
                onUploadComplete={() => {
                  queryClient.invalidateQueries({
                    queryKey: knowledgeSourceKeys.detail(sourceId),
                  });
                  queryClient.invalidateQueries({
                    queryKey: knowledgeKeys.items(),
                  });
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Crawl Config (if present) */}
        {source.crawl_config && Object.keys(source.crawl_config).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Crawl Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {source.crawl_config.max_pages && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Pages</span>
                  <span className="font-medium">{source.crawl_config.max_pages}</span>
                </div>
              )}
              {source.crawl_config.include_paths && source.crawl_config.include_paths.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Include Paths</span>
                  <span className="font-medium">{source.crawl_config.include_paths.join(", ")}</span>
                </div>
              )}
              {source.crawl_config.exclude_paths && source.crawl_config.exclude_paths.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exclude Paths</span>
                  <span className="font-medium">{source.crawl_config.exclude_paths.join(", ")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        {canSync && (
          <Card>
            <CardHeader>
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
                <div className="space-y-3">
                  {syncHistory.slice(0, 5).map((sync) => (
                    <div
                      key={sync.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusBadge(sync.status)}
                        <div>
                          <p className="text-sm font-medium">
                            {sync.sync_type === "full"
                              ? "Full Sync"
                              : "Incremental Sync"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sync.started_at || sync.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {sync.status === "completed" && (
                          <p className="text-muted-foreground">
                            {sync.items_created} created, {sync.items_updated} updated
                          </p>
                        )}
                        {sync.status === "failed" && sync.error_message && (
                          <p
                            className="text-red-600 text-xs max-w-xs truncate"
                            title={sync.error_message}
                          >
                            {sync.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <WarningModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="Delete Knowledge Source"
        description={
          <>
            Are you sure you want to delete <strong>{source.name}</strong>? This
            action cannot be undone. All indexed content will be removed.
          </>
        }
        variant="delete"
        isLoading={isDeleting}
      />
    </ScrollArea>
  );
}

function SettingsPanelSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
