"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { useOrganization } from "@/providers/OrganizationProvider";
import { useSearchParams } from "next/navigation";

export default function TeamPage() {
  const { currentOrganizationId } = useOrganization();
  const searchParams = useSearchParams();

  // Check URL param for default tab
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam === "permissions" ? "permissions" : "members";

  if (!currentOrganizationId) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Team"
          description="Manage your team members and permissions"
        />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return <UserManagementPanel organizationId={currentOrganizationId} />;
}
