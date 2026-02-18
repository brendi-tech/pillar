"use client";

import { SectionLabel, TimestampFooter } from "@/components/shared";
import {
  deleteKnowledgeItemMutation,
  getDocumentDownloadUrlMutation,
  knowledgeKeys,
  reprocessKnowledgeItemMutation,
  updateKnowledgeItemMutation,
} from "@/queries/knowledge.queries";
import { KnowledgeItem } from "@/types/knowledge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ContentPreviewCard } from "./ContentPreviewCard";
import { FileInfoSection } from "./FileInfoSection";
import { ItemHeader } from "./ItemHeader";
import { ItemMetadataSection } from "./ItemMetadataSection";
import { ProcessingErrorAlert } from "./ProcessingErrorAlert";

interface DocumentItemDetailProps {
  item: KnowledgeItem;
  itemId: string;
  onDeleted?: () => void;
}

export function DocumentItemDetail({
  item,
  itemId,
  onDeleted,
}: DocumentItemDetailProps) {
  const queryClient = useQueryClient();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingDownloadUrl, setIsLoadingDownloadUrl] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fileType = item.metadata?.file_type as string | undefined;
  const originalFilename = item.metadata?.original_filename as
    | string
    | undefined;
  const fileSizeBytes = item.metadata?.file_size_bytes as number | undefined;

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
    if (!downloadUrl && !isLoadingDownloadUrl) {
      setIsLoadingDownloadUrl(true);
      downloadUrlMutation.mutate(itemId, {
        onSettled: () => setIsLoadingDownloadUrl(false),
      });
    }
  }, [downloadUrl, isLoadingDownloadUrl, downloadUrlMutation, itemId]);

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

  return (
    <>
      <ItemHeader
        item={item}
        onToggleActive={handleToggleActive}
        onReprocess={handleReprocess}
        onDelete={handleDelete}
        isUpdating={updateMutation.isPending}
        isReprocessing={reprocessMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />

      <ItemMetadataSection item={item} />

      {item.status === "failed" && item.processing_error && (
        <ProcessingErrorAlert error={item.processing_error} />
      )}

      <FileInfoSection
        filename={originalFilename}
        fileType={fileType}
        fileSizeBytes={fileSizeBytes}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />

      {item.excerpt && (
        <div>
          <SectionLabel>Excerpt</SectionLabel>
          <p className="text-sm leading-relaxed">{item.excerpt}</p>
        </div>
      )}

      <ContentPreviewCard
        item={item}
        isDocumentUpload={true}
        downloadUrl={downloadUrl}
        isLoadingDownloadUrl={isLoadingDownloadUrl}
        fileType={fileType}
        originalFilename={originalFilename}
        fileSizeBytes={fileSizeBytes}
        onDownload={handleDownload}
        isDownloading={isDownloading}
        onRequestDownloadUrl={fetchDownloadUrl}
      />

      <TimestampFooter createdAt={item.created_at} updatedAt={item.updated_at} />
    </>
  );
}
