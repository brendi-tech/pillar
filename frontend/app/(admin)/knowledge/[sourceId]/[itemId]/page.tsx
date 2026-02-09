"use client";

import { KnowledgeItemDetail } from "@/components/KnowledgeItemDetail";
import { useRouter } from "next/navigation";
import { use, useCallback } from "react";

interface KnowledgeItemPageProps {
  params: Promise<{
    sourceId: string;
    itemId: string;
  }>;
}

/**
 * Knowledge Item detail page - shows KnowledgeItemDetail for the selected item.
 * The sidebar is rendered by the layout.
 */
export default function KnowledgeItemPage({ params }: KnowledgeItemPageProps) {
  const { sourceId, itemId } = use(params);
  const router = useRouter();

  const handleDeleted = useCallback(() => {
    router.push(`/knowledge/${sourceId}`);
  }, [router, sourceId]);

  return (
    <KnowledgeItemDetail
      itemId={itemId}
      sourceId={sourceId}
      onDeleted={handleDeleted}
    />
  );
}
