"use client";

import { PageHeader } from "@/components/shared";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  deleteKnowledgeItemMutation,
  knowledgeItemDetailQuery,
  knowledgeKeys,
  knowledgeSourceDetailQuery,
  reprocessKnowledgeItemMutation,
  updateKnowledgeItemMutation,
} from "@/queries/knowledge.queries";
import {
  KNOWLEDGE_ITEM_STATUS_COLORS,
  KNOWLEDGE_ITEM_STATUS_LABELS,
  KNOWLEDGE_ITEM_TYPE_LABELS,
} from "@/types/knowledge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getDocumentDownloadUrlMutation } from "@/queries/knowledge.queries";

// File type detection helpers
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

interface KnowledgeItemDetailProps {
  itemId: string;
  sourceId: string;
  onDeleted?: () => void;
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

export function KnowledgeItemDetail({
  itemId,
  sourceId,
  onDeleted,
}: KnowledgeItemDetailProps) {
  const queryClient = useQueryClient();
  const [activeContentTab, setActiveContentTab] = useState<"optimized" | "original">("optimized");
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingDownloadUrl, setIsLoadingDownloadUrl] = useState(false);

  const {
    data: item,
    isPending,
    isError,
    error,
  } = useQuery(knowledgeItemDetailQuery(itemId));

  const { data: source } = useQuery(knowledgeSourceDetailQuery(sourceId));

  // Check if this is a document upload with a file
  const isDocumentUpload = Boolean(item?.metadata?.file_path);
  const fileType = item?.metadata?.file_type as string | undefined;
  const fileViewType = getFileViewType(fileType);
  const originalFilename = item?.metadata?.original_filename as string | undefined;
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

  // Fetch download URL when viewing a document upload
  const fetchDownloadUrl = useCallback(() => {
    if (isDocumentUpload && !downloadUrl && !isLoadingDownloadUrl) {
      setIsLoadingDownloadUrl(true);
      downloadUrlMutation.mutate(itemId, {
        onSettled: () => setIsLoadingDownloadUrl(false),
      });
    }
  }, [isDocumentUpload, downloadUrl, isLoadingDownloadUrl, downloadUrlMutation, itemId]);

  // Fetch download URL when switching to original tab for document uploads
  useEffect(() => {
    if (activeContentTab === "original" && isDocumentUpload && !downloadUrl) {
      fetchDownloadUrl();
    }
  }, [activeContentTab, isDocumentUpload, downloadUrl, fetchDownloadUrl]);

  // Handle download button click - use axios to fetch, then trigger download
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Use the API client which already handles auth and CORS
      const { apiClient } = await import("@/lib/admin/api-client");

      const response = await apiClient.get(
        `/api/admin/knowledge/items/${itemId}/download/`,
        { responseType: "blob" }
      );

      // Create blob URL from response
      const blob = new Blob([response.data]);
      const blobUrl = URL.createObjectURL(blob);

      // Create anchor and trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = originalFilename || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
      toast.success("Download complete");
    } catch (error) {
      console.error("Download error:", error);
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

  if (isPending) {
    return (
      <div className="space-y-6 p-page">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-1 h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex flex-col items-center justify-center p-page py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load item</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message || "Item not found"}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/knowledge/${sourceId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Source
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-page h-full overflow-auto">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="truncate">{item.title || "Untitled"}</span>
          </div>
        }
        description={KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReprocess}
              disabled={
                reprocessMutation.isPending || item.status === "processing"
              }
            >
              {reprocessMutation.isPending || item.status === "processing" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reprocess
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Knowledge Item</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{item.title}&quot;?
                    This will remove this content from the knowledge base and
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {/* Item Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Item Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1">
                <Badge variant={getStatusBadgeVariant(item.status)}>
                  {item.status === "processing" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {KNOWLEDGE_ITEM_STATUS_LABELS[item.status] || item.status}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Active
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <Checkbox
                  checked={item.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={updateMutation.isPending}
                />
                <span className="text-sm">
                  {item.is_active ? "Available to AI" : "Hidden from AI"}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Type
              </dt>
              <dd className="mt-1 text-sm">
                {KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type]}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Chunks
              </dt>
              <dd className="mt-1 text-lg font-semibold">{item.chunk_count}</dd>
            </div>

            {item.url && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Source URL
                </dt>
                <dd className="mt-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.url}</span>
                  </a>
                </dd>
              </div>
            )}

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 text-sm">
                {format(new Date(item.created_at), "MMM d, yyyy")}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Updated
              </dt>
              <dd className="mt-1 text-sm">
                {formatDistanceToNow(new Date(item.updated_at), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          </dl>

          {item.status === "failed" && item.processing_error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                <strong>Error:</strong> {item.processing_error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Information - for document uploads only */}
      {isDocumentUpload && (
        <Card>
          <CardHeader>
            <CardTitle>File Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <dl className="grid gap-4 sm:grid-cols-3 flex-1">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Filename
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {originalFilename || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    File Type
                  </dt>
                  <dd className="mt-1 text-sm">
                    {fileType?.toUpperCase() || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    File Size
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatFileSize(fileSizeBytes)}
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isLoadingDownloadUrl || isDownloading}
              >
                {isLoadingDownloadUrl || isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excerpt */}
      {item.excerpt && (
        <Card>
          <CardHeader>
            <CardTitle>Excerpt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{item.excerpt}</p>
          </CardContent>
        </Card>
      )}

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Content Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeContentTab}
            onValueChange={(value) =>
              setActiveContentTab(value as "optimized" | "original")
            }
          >
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger
                  value="optimized"
                  disabled={!item.optimized_content}
                >
                  Optimized
                  {item.optimized_content && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      AI
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="original" disabled={!item.raw_content && !isDocumentUpload}>
                  Original
                </TabsTrigger>
              </TabsList>
              {/* Only show copy button when displaying text content */}
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
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>

            <TabsContent value="optimized">
              <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {item.optimized_content || "No optimized content available"}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="original">
              {isDocumentUpload ? (
                // Document upload - show appropriate viewer
                <div className="h-[400px] w-full rounded-md border bg-muted/30">
                  {isLoadingDownloadUrl ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : fileViewType === "pdf" && downloadUrl ? (
                    // PDF Viewer
                    <iframe
                      src={downloadUrl}
                      className="h-full w-full rounded-md"
                      title={originalFilename || "PDF Document"}
                    />
                  ) : fileViewType === "image" && downloadUrl ? (
                    // Image Viewer - using img for dynamic signed URL
                    <div className="flex h-full items-center justify-center p-4 overflow-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={downloadUrl}
                        alt={originalFilename || "Image"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    // Download prompt for other file types
                    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                      {(() => {
                        const FileIcon = getFileIcon(fileType);
                        return <FileIcon className="h-16 w-16 text-muted-foreground" />;
                      })()}
                      <div className="text-center">
                        <p className="font-medium">{originalFilename || "Document"}</p>
                        <p className="text-sm text-muted-foreground">
                          {fileType?.toUpperCase()} · {formatFileSize(fileSizeBytes)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Download to view the original file
                      </p>
                      <Button
                        onClick={handleDownload}
                        disabled={isLoadingDownloadUrl || isDownloading}
                      >
                        {isLoadingDownloadUrl || isDownloading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {isDownloading ? "Downloading..." : "Download Original"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                // Regular content - show text
                <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/30 p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {item.raw_content || "No original content available"}
                  </pre>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Metadata - filter out internal/file-related fields shown elsewhere */}
      {item.metadata && (() => {
        // Fields to hide from the general metadata display
        const hiddenFields = [
          "file_path",
          "original_filename",
          "file_size_bytes",
          "file_type",
          "uploaded_at",
        ];
        const filteredEntries = Object.entries(item.metadata).filter(
          ([key]) => !hiddenFields.includes(key)
        );
        
        if (filteredEntries.length === 0) return null;
        
        return (
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filteredEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
