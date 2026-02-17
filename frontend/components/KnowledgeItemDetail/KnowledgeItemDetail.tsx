"use client";

import type { MetadataItem } from "@/components/shared";
import {
  DetailHeader,
  DetailPageShell,
  MetadataStrip,
  SectionLabel,
  TimestampFooter,
} from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteKnowledgeItemMutation,
  getDocumentDownloadUrlMutation,
  knowledgeItemDetailQuery,
  knowledgeKeys,
  knowledgeSourceDetailQuery,
  reprocessKnowledgeItemMutation,
  updateKnowledgeItemMutation,
} from "@/queries/knowledge.queries";
import {
  KNOWLEDGE_ITEM_STATUS_COLORS,
  KNOWLEDGE_ITEM_TYPE_LABELS,
} from "@/types/knowledge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// =============================================================================
// File type detection helpers
// =============================================================================

const VIEWABLE_IMAGE_TYPES = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const VIEWABLE_PDF_TYPES = ["pdf"];

type FileViewType = "pdf" | "image" | "download" | "text";

function getFileViewType(fileType: string | undefined): FileViewType {
  if (!fileType) return "text";
  const type = fileType.toLowerCase();
  if (VIEWABLE_PDF_TYPES.includes(type)) return "pdf";
  if (VIEWABLE_IMAGE_TYPES.includes(type)) return "image";
  return "download";
}

function getFileIcon(fileType: string | undefined) {
  if (!fileType) return FileText;
  const type = fileType.toLowerCase();
  if (VIEWABLE_PDF_TYPES.includes(type)) return FileType;
  if (VIEWABLE_IMAGE_TYPES.includes(type)) return FileImage;
  if (["xlsx", "xls", "csv"].includes(type)) return FileSpreadsheet;
  if (["docx", "doc"].includes(type)) return FileText;
  return File;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const colorMap: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    green: "default",
    blue: "secondary",
    red: "destructive",
    yellow: "outline",
  };
  const color =
    KNOWLEDGE_ITEM_STATUS_COLORS[
      status as keyof typeof KNOWLEDGE_ITEM_STATUS_COLORS
    ] || "gray";
  return colorMap[color] || "secondary";
}

// =============================================================================
// Main Component
// =============================================================================

interface KnowledgeItemDetailProps {
  itemId: string;
  sourceId: string;
  onDeleted?: () => void;
}

export function KnowledgeItemDetail({
  itemId,
  sourceId,
  onDeleted,
}: KnowledgeItemDetailProps) {
  const queryClient = useQueryClient();
  const [activeContentTab, setActiveContentTab] = useState<
    "optimized" | "original"
  >("optimized");
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingDownloadUrl, setIsLoadingDownloadUrl] = useState(false);

  const {
    data: item,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(knowledgeItemDetailQuery(itemId));

  const { data: source } = useQuery(knowledgeSourceDetailQuery(sourceId));

  // Check if this is a document upload with a file
  const isDocumentUpload = Boolean(item?.metadata?.file_path);
  const fileType = item?.metadata?.file_type as string | undefined;
  const fileViewType = getFileViewType(fileType);
  const originalFilename = item?.metadata?.original_filename as
    | string
    | undefined;
  const fileSizeBytes = item?.metadata?.file_size_bytes as number | undefined;

  const downloadUrlMutation = useMutation({
    ...getDocumentDownloadUrlMutation(),
    onSuccess: (data) => {
      setDownloadUrl(data.download_url);
    },
    onError: (err: Error) => {
      toast.error(`Failed to get download URL: ${err.message}`);
    },
  });

  const fetchDownloadUrl = useCallback(() => {
    if (isDocumentUpload && !downloadUrl && !isLoadingDownloadUrl) {
      setIsLoadingDownloadUrl(true);
      downloadUrlMutation.mutate(itemId, {
        onSettled: () => setIsLoadingDownloadUrl(false),
      });
    }
  }, [
    isDocumentUpload,
    downloadUrl,
    isLoadingDownloadUrl,
    downloadUrlMutation,
    itemId,
  ]);

  useEffect(() => {
    if (activeContentTab === "original" && isDocumentUpload && !downloadUrl) {
      fetchDownloadUrl();
    }
  }, [activeContentTab, isDocumentUpload, downloadUrl, fetchDownloadUrl]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const { apiClient } = await import("@/lib/admin/api-client");
      const response = await apiClient.get(
        `/api/admin/knowledge/items/${itemId}/download/`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data]);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = originalFilename || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Download complete");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  }, [itemId, originalFilename]);

  // Set initial tab based on content availability
  const itemId_forTabEffect = item?.id;
  const hasOptimizedContent = item?.optimized_content;
  useEffect(() => {
    if (itemId_forTabEffect) {
      setActiveContentTab(hasOptimizedContent ? "optimized" : "original");
    }
  }, [itemId_forTabEffect, hasOptimizedContent]);

  const updateMutation = useMutation({
    ...updateKnowledgeItemMutation(),
    onSuccess: () => {
      toast.success("Item updated");
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.itemDetail(itemId),
      });
    },
    onError: (err: Error) => {
      toast.error(`Failed to update item: ${err.message}`);
    },
  });

  const reprocessMutation = useMutation({
    ...reprocessKnowledgeItemMutation(),
    onSuccess: () => {
      toast.success("Reprocessing started");
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.itemDetail(itemId),
      });
    },
    onError: (err: Error) => {
      toast.error(`Failed to reprocess: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    ...deleteKnowledgeItemMutation(),
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
      onDeleted?.();
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  const handleToggleActive = () => {
    if (!item) return;
    updateMutation.mutate({
      id: itemId,
      data: { is_active: !item.is_active },
    });
  };

  const handleReprocess = () => {
    reprocessMutation.mutate(itemId);
  };

  const handleDelete = () => {
    deleteMutation.mutate(itemId);
  };

  // Build metadata items — unified from top strip + bottom metadata
  const metadataItems: MetadataItem[] = [];
  // Track which metadata keys we've promoted so we don't double-show them
  const promotedMetadataKeys = new Set([
    "file_path",
    "original_filename",
    "file_size_bytes",
    "file_type",
    "uploaded_at",
    "word_count",
    "scraped_at",
  ]);

  if (item) {
    // Short status label — badge color provides the context
    const statusLabel = !item.is_active
      ? "Excluded"
      : item.status === "indexed"
        ? "Searchable"
        : item.status === "processing"
          ? "Processing"
          : item.status === "failed"
            ? "Failed"
            : "Processing";

    metadataItems.push({
      label: "Status",
      value: (
        <Badge
          variant={
            !item.is_active ? "secondary" : getStatusBadgeVariant(item.status)
          }
        >
          {item.status === "processing" && item.is_active && (
            <Spinner size="xs" className="mr-1" />
          )}
          {statusLabel}
        </Badge>
      ),
    });

    metadataItems.push({
      label: "Type",
      value: KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type],
    });

    if (item.status === "indexed") {
      metadataItems.push({
        label: "Chunks",
        value: (
          <span className="font-semibold tabular-nums">{item.chunk_count}</span>
        ),
      });
    }

    // Promote common metadata fields with nice formatting
    const wordCount = item.metadata?.word_count;
    if (wordCount != null) {
      metadataItems.push({
        label: "Word Count",
        value: (
          <span className="tabular-nums">
            {Number(wordCount).toLocaleString()}
          </span>
        ),
      });
    }

    const scrapedAt = item.metadata?.scraped_at;
    if (scrapedAt) {
      metadataItems.push({
        label: "Scraped",
        value: new Date(String(scrapedAt)).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }

    if (item.url) {
      metadataItems.push({
        label: "Source URL",
        value: (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.url}</span>
          </a>
        ),
        colSpan: 2,
      });
    }

    // Add any remaining dynamic metadata fields we haven't promoted
    if (item.metadata) {
      const remainingEntries = Object.entries(item.metadata).filter(
        ([key]) => !promotedMetadataKeys.has(key)
      );
      for (const [key, value] of remainingEntries) {
        if (value == null || value === "") continue;
        metadataItems.push({
          label: key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          value:
            typeof value === "object" ? JSON.stringify(value) : String(value),
        });
      }
    }
  }

  return (
    <DetailPageShell
      isLoading={isPending}
      error={isError ? (error ?? new Error("Item not found")) : null}
      isEmpty={!item && !isPending && !isError}
      emptyTitle="Item not found"
      emptyDescription="This knowledge item may have been deleted."
      onRetry={refetch}
    >
      {item && (
        <>
          {/* ── Header ── */}
          <DetailHeader
            icon={<FileText className="h-5 w-5 text-muted-foreground" />}
            title={item.title || "Untitled"}
            subtitle={KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type]}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={handleToggleActive}
                    disabled={updateMutation.isPending}
                    aria-label="Include in AI search"
                  />
                  <span className="hidden xs:inline">
                    {item.is_active ? "In search" : "Excluded"}
                  </span>
                </label>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReprocess}
                  disabled={
                    reprocessMutation.isPending || item.status === "processing"
                  }
                >
                  {reprocessMutation.isPending ||
                  item.status === "processing" ? (
                    <Spinner size="sm" className="sm:mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 sm:mr-1.5" />
                  )}
                  <span className="hidden sm:inline">Reprocess</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Knowledge Item</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{item.title}
                        &quot;? This will remove this content from the knowledge
                        base and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            }
          />

          {/* ── Item Information (metadata strip) ── */}
          <MetadataStrip items={metadataItems} columns={4} />

          {/* ── Processing Error ── */}
          {item.status === "failed" && item.processing_error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Processing Error
                </p>
                <p className="max-w-prose text-sm text-red-700 dark:text-red-300 mt-0.5">
                  {item.processing_error}
                </p>
              </div>
            </div>
          )}

          {/* ── File Information (document uploads) ── */}
          {isDocumentUpload && (
            <div>
              <SectionLabel className="mb-2">File Information</SectionLabel>
              <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 sm:flex-1">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-xs text-muted-foreground">
                      Filename
                    </span>
                    <p className="font-medium mt-0.5 truncate">
                      {originalFilename || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      File Type
                    </span>
                    <p className="font-medium mt-0.5">
                      {fileType?.toUpperCase() || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      File Size
                    </span>
                    <p className="font-medium mt-0.5">
                      {formatFileSize(fileSizeBytes)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isLoadingDownloadUrl || isDownloading}
                  className="w-full sm:w-auto"
                >
                  {isLoadingDownloadUrl || isDownloading ? (
                    <Spinner size="sm" className="mr-1.5" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Excerpt ── */}
          {item.excerpt && (
            <div>
              <SectionLabel>Excerpt</SectionLabel>
              <p className="text-sm leading-relaxed">{item.excerpt}</p>
            </div>
          )}

          {/* ── Content Preview ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Content Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeContentTab}
                onValueChange={(value) =>
                  setActiveContentTab(value as "optimized" | "original")
                }
              >
                <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger
                      value="optimized"
                      disabled={!item.optimized_content}
                      className="flex-1 sm:flex-none"
                    >
                      Optimized
                      {item.optimized_content && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          AI
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="original"
                      disabled={!item.raw_content && !isDocumentUpload}
                      className="flex-1 sm:flex-none"
                    >
                      Original
                    </TabsTrigger>
                  </TabsList>
                  {!(activeContentTab === "original" && isDocumentUpload) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const content =
                          activeContentTab === "optimized"
                            ? item.optimized_content
                            : item.raw_content;
                        if (content) {
                          navigator.clipboard.writeText(content);
                          setCopied(true);
                          toast.success("Copied to clipboard");
                          setTimeout(() => setCopied(false), 2000);
                        }
                      }}
                      disabled={
                        activeContentTab === "optimized"
                          ? !item.optimized_content
                          : !item.raw_content
                      }
                      className="w-full sm:w-auto"
                    >
                      {copied ? (
                        <Check className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Copy className="mr-1.5 h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  )}
                </div>

                <TabsContent value="optimized">
                  <ScrollArea className="h-[50vh] min-h-[300px] max-h-[500px] w-full rounded-md border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono break-words">
                      {item.optimized_content ||
                        "No optimized content available"}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="original">
                  {isDocumentUpload ? (
                    <div className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30">
                      {isLoadingDownloadUrl ? (
                        <div className="flex h-full items-center justify-center">
                          <Spinner size="lg" />
                        </div>
                      ) : fileViewType === "pdf" && downloadUrl ? (
                        <iframe
                          src={downloadUrl}
                          className="h-full w-full rounded-md"
                          title={originalFilename || "PDF Document"}
                        />
                      ) : fileViewType === "image" && downloadUrl ? (
                        <div className="flex h-full items-center justify-center p-4 overflow-auto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={downloadUrl}
                            alt={originalFilename || "Image"}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 p-4 sm:p-8">
                          {(() => {
                            const FileIcon = getFileIcon(fileType);
                            return (
                              <FileIcon className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
                            );
                          })()}
                          <div className="text-center">
                            <p className="font-medium break-all px-2">
                              {originalFilename || "Document"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {fileType?.toUpperCase()} ·{" "}
                              {formatFileSize(fileSizeBytes)}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            Download to view the original file
                          </p>
                          <Button
                            onClick={handleDownload}
                            disabled={isLoadingDownloadUrl || isDownloading}
                            className="w-full sm:w-auto"
                          >
                            {isLoadingDownloadUrl || isDownloading ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            {isDownloading
                              ? "Downloading..."
                              : "Download Original"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[60vh] min-h-[400px] max-h-[800px] w-full rounded-md border bg-muted/30 p-4">
                      <pre className="whitespace-pre-wrap text-sm font-mono break-words">
                        {item.raw_content || "No original content available"}
                      </pre>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* ── Timestamps footer ── */}
          <TimestampFooter
            createdAt={item.created_at}
            updatedAt={item.updated_at}
          />
        </>
      )}
    </DetailPageShell>
  );
}
