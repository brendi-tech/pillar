"use client";

import { AddSourceWizard } from "@/components/Sources";
import { PageHeader } from "@/components/shared";

export default function NewKnowledgeSourcePage() {
  return (
    <div className=" p-page">
      <PageHeader
        title="Add Knowledge Source"
        description="Add a new knowledge source to provide context for the AI."
      />

      <AddSourceWizard />
    </div>
  );
}
