"use client";

import { SourceSettingsPanel } from "@/components/Sources/SourcesPage/SourceSettingsPanel";
import { useRouter } from "next/navigation";
import { use, useCallback } from "react";

interface KnowledgeSourcePageProps {
  params: Promise<{
    sourceId: string;
  }>;
}

/**
 * Knowledge Source detail page - shows SourceSettingsPanel for the selected source.
 * The sidebar is rendered by the layout.
 */
export default function KnowledgeSourcePage({ params }: KnowledgeSourcePageProps) {
  const { sourceId } = use(params);
  const router = useRouter();

  const handleDeleted = useCallback(() => {
    router.push("/knowledge");
  }, [router]);

  return <SourceSettingsPanel sourceId={sourceId} onDeleted={handleDeleted} />;
}
