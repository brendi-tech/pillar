"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BillingPageContent } from "@/components/BillingPageContent";

export default function BillingPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription, usage, and payment settings"
      />
      <BillingPageContent />
    </div>
  );
}
