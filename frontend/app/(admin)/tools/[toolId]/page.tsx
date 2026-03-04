"use client";

import { ToolDetailPage } from "@/components/ToolDetailPage";
import { use } from "react";

interface ActionPageProps {
  params: Promise<{
    toolId: string;
  }>;
}

/**
 * Action detail page - view and edit a specific action.
 */
export default function ActionPage({ params }: ActionPageProps) {
  const { toolId } = use(params);

  return <ToolDetailPage toolId={toolId} />;
}
