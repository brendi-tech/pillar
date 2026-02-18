"use client";

import { SectionLabel, TimestampFooter } from "@/components/shared";
import {
  deleteKnowledgeItemMutation,
  knowledgeKeys,
  reprocessKnowledgeItemMutation,
  updateKnowledgeItemMutation,
} from "@/queries/knowledge.queries";
import { KnowledgeItem } from "@/types/knowledge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContentPreviewCard } from "./ContentPreviewCard";
import { ItemHeader } from "./ItemHeader";
import { ItemMetadataSection } from "./ItemMetadataSection";
import { ProcessingErrorAlert } from "./ProcessingErrorAlert";

interface TextItemDetailProps {
  item: KnowledgeItem;
  itemId: string;
  onDeleted?: () => void;
}

export function TextItemDetail({
  item,
  itemId,
  onDeleted,
}: TextItemDetailProps) {
  const queryClient = useQueryClient();

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

      {item.excerpt && (
        <div>
          <SectionLabel>Excerpt</SectionLabel>
          <p className="text-sm leading-relaxed">{item.excerpt}</p>
        </div>
      )}

      <ContentPreviewCard
        item={item}
        isDocumentUpload={false}
        downloadUrl={null}
        isLoadingDownloadUrl={false}
        onDownload={() => {}}
        isDownloading={false}
      />

      <TimestampFooter createdAt={item.created_at} updatedAt={item.updated_at} />
    </>
  );
}
