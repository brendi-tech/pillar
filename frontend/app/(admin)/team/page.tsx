"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { TeamPermissionsPanel } from "@/components/TeamPermissionsPanel";
import { useOrganization } from "@/providers/OrganizationProvider";
import { Users, Shield } from "lucide-react";

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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Team"
        description="Manage your team members and permissions"
      />
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <UserManagementPanel organizationId={currentOrganizationId} />
        </TabsContent>
        <TabsContent value="permissions" className="mt-6">
          <TeamPermissionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
