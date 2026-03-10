"use client";

import { AddSourceWizard } from "@/components/Sources";
import { PageHeader } from "@/components/shared";

export default function NewKnowledgeSourcePage() {
  return (
    <div className="space-y-6 p-page">
      <PageHeader
        className="pb-4"
        title="Add Knowledge Source"
        description="Add a new knowledge source to provide context for the AI."
      />

      <AddSourceWizard />
    </div>
  );
}
