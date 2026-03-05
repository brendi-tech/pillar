"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { UsersPageContent } from "@/components/UsersPageContent";

export default function UsersPage() {
  return (
    <div className="p-page flex h-full overflow-hidden flex-col gap-6 max-md:gap-4">
      <PageHeader
        title="Users"
        description="View end-users who have been identified via the SDK"
      />
      <UsersPageContent />
    </div>
  );
}
