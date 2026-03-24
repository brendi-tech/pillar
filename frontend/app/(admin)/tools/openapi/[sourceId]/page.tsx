"use client";

import { OpenAPISourceDetailPage } from "@/components/OpenAPISourceDetailPage";
import { use } from "react";

interface OpenAPISourcePageProps {
  params: Promise<{
    sourceId: string;
  }>;
}

export default function OpenAPISourcePage({ params }: OpenAPISourcePageProps) {
  const { sourceId } = use(params);

  return <OpenAPISourceDetailPage sourceId={sourceId} />;
}
