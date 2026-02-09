"use client";

import { AddSourceWizard } from "@/components/Sources";
import { ContentEmptyState } from "@/components/Sources/SourcesPage/SourcesEmpty";
import { PageHeader } from "@/components/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useSources } from "@/providers";

/**
 * Knowledge page - shows AddSourceWizard when no sources exist,
 * otherwise shows empty state when no source is selected.
 * The sidebar is rendered by the layout.
 */
export default function KnowledgePage() {
  const { sources, isLoading } = useSources();

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Spinner variant="border" size="lg" />
      </div>
    );
  } 

  // Show AddSourceWizard when no sources exist
  if (!isLoading && sources.length === 0) {
    return (
      <div className="h-full overflow-hidden">
        <ScrollArea className="h-full p-page">
          <PageHeader
            className="pb-4"
            title="Add Knowledge Source"
            description="Add a new knowledge source to provide context for the AI."
          />
          <AddSourceWizard />
        </ScrollArea>
      </div>
    );
  }

  return <ContentEmptyState />;
}
