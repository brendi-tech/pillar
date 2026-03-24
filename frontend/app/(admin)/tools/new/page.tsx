"use client";

import { AddToolsWizard } from "@/components/AddToolsWizard";
import { PageHeader } from "@/components/shared";

export default function NewToolsPage() {
  return (
    <div className="p-page">
      <PageHeader
        title="Add Tools"
        description="Add new tools for your AI assistant to use."
      />
      <AddToolsWizard />
    </div>
  );
}
