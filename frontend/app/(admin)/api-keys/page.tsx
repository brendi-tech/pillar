"use client";

import { ApiKeysPageContent } from "@/components/ApiKeysPageContent";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title="API Keys"
        description="Manage sync secrets for your CI/CD pipeline"
      />
      <ApiKeysPageContent />
    </div>
  );
}
