"use client";

import { MCPSourceDetailPage } from "@/components/MCPSourceDetailPage";
import { use } from "react";

interface MCPSourcePageProps {
  params: Promise<{
    sourceId: string;
  }>;
}

export default function MCPSourcePage({ params }: MCPSourcePageProps) {
  const { sourceId } = use(params);

  return <MCPSourceDetailPage sourceId={sourceId} />;
}
