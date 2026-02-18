"use client";

import { DetailPageShell } from "@/components/shared";
import { useWebSocketEvent } from "@/hooks/use-websocket-event";
import {
  knowledgeItemDetailQuery,
  knowledgeKeys,
  knowledgeSourceDetailQuery,
} from "@/queries/knowledge.queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { DocumentItemDetail } from "./DocumentItemDetail";
import { TextItemDetail } from "./TextItemDetail";

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

  const {
    data: item,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(knowledgeItemDetailQuery(itemId));

  // Keep source query for potential future use (breadcrumbs, navigation)
  useQuery(knowledgeSourceDetailQuery(sourceId));

  const handleItemProcessed = useCallback(
    (event: CustomEvent) => {
      const data = event.detail;
      if (data.status === "indexed") {
        toast.success("Processing complete");
      } else if (data.status === "failed") {
        toast.error("Processing failed");
      }
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.itemDetail(itemId),
      });
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });
    },
    [itemId, queryClient]
  );

  useWebSocketEvent(
    `websocket:knowledge_item.${itemId}.processed`,
    handleItemProcessed
  );

  const isDocumentUpload = Boolean(item?.metadata?.file_path);

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
          {isDocumentUpload ? (
            <DocumentItemDetail
              item={item}
              itemId={itemId}
              onDeleted={onDeleted}
            />
          ) : (
            <TextItemDetail item={item} itemId={itemId} onDeleted={onDeleted} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
