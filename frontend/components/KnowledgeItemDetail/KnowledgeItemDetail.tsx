"use client";

import { DetailPageShell } from "@/components/shared";
import {
  knowledgeItemDetailQuery,
  knowledgeSourceDetailQuery,
} from "@/queries/knowledge.queries";
import { useQuery } from "@tanstack/react-query";
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
  const {
    data: item,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(knowledgeItemDetailQuery(itemId));

  // Keep source query for potential future use (breadcrumbs, navigation)
  useQuery(knowledgeSourceDetailQuery(sourceId));

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
