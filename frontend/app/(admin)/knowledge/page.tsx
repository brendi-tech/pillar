"use client";

import { AddSourceWizard } from "@/components/Sources";
import { PageHeader } from "@/components/shared";
import { Spinner } from "@/components/ui/spinner";
import { useSources } from "@/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Knowledge page - shows AddSourceWizard when no sources exist,
 * otherwise redirects to the first source.
 * The sidebar is rendered by the layout.
 */
export default function KnowledgePage() {
  const { sources, isLoading } = useSources();
  const router = useRouter();

  // Redirect to first source if sources exist
  useEffect(() => {
    if (!isLoading && sources.length > 0) {
      router.replace(`/knowledge/${sources[0].id}`);
    }
  }, [isLoading, sources, router]);

  if (isLoading || sources.length > 0) {
    return (
      <div className="h-dvh grid place-items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show AddSourceWizard when no sources exist
  return (
    <div>
      <PageHeader
        className="pt-4"
        title="Add Knowledge Source"
        description="Add a new knowledge source to provide context for the AI."
      />
      <AddSourceWizard />
    </div>
  );
}
