"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionsTable } from "./PermissionsTable";

// Types
export type Resource =
  | "production"
  | "staging"
  | "analytics"
  | "billing"
  | "team";
export type PermissionLevel = "none" | "view" | "edit" | "admin";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  permissions: Record<Resource, PermissionLevel>;
}

// Mock initial data - realistic team with varied permissions
const initialMockUsers: MockUser[] = [
  {
    id: "user-1",
    name: "Sarah Chen",
    email: "sarah@company.com",
    permissions: {
      production: "admin",
      staging: "admin",
      analytics: "edit",
      billing: "view",
      team: "admin",
    },
  },
  {
    id: "user-2",
    name: "John Martinez",
    email: "john@company.com",
    permissions: {
      production: "view",
      staging: "edit",
      analytics: "view",
      billing: "none",
      team: "none",
    },
  },
  {
    id: "user-3",
    name: "Alex Kim",
    email: "alex@company.com",
    permissions: {
      production: "edit",
      staging: "edit",
      analytics: "edit",
      billing: "none",
      team: "view",
    },
  },
  {
    id: "user-4",
    name: "Emily Johnson",
    email: "emily@company.com",
    permissions: {
      production: "none",
      staging: "view",
      analytics: "admin",
      billing: "edit",
      team: "view",
    },
  },
  {
    id: "user-5",
    name: "Michael Brown",
    email: "michael@company.com",
    permissions: {
      production: "view",
      staging: "view",
      analytics: "view",
      billing: "view",
      team: "none",
    },
  },
];

// Global state for Pillar card access (cards run outside React tree)
// Initialize with mock data so it's available before component mounts
let globalPermissionsState: MockUser[] = [...initialMockUsers];
let globalUpdatePermission:
  | ((userId: string, resource: Resource, level: PermissionLevel) => void)
  | null = null;

export function getGlobalPermissions(): MockUser[] {
  return globalPermissionsState;
}

export function getGlobalUpdatePermission() {
  return globalUpdatePermission;
}

export function TeamPermissionsPanel() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<MockUser[]>(initialMockUsers);
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);

  // Check URL param to highlight specific user
  const highlightParam = searchParams.get("highlight");

  useEffect(() => {
    if (highlightParam) {
      setHighlightUserId(highlightParam);
      // Remove highlight after animation
      const timer = setTimeout(() => setHighlightUserId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightParam]);

  // Update permission for a user
  const updatePermission = (
    userId: string,
    resource: Resource,
    level: PermissionLevel
  ) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              permissions: {
                ...user.permissions,
                [resource]: level,
              },
            }
          : user
      )
    );
  };

  // Update global state for Pillar handler
  useEffect(() => {
    globalPermissionsState = users;
    globalUpdatePermission = updatePermission;
  }, [users]);

  return (
    <Card
      className={cn(
        "transition-all duration-500",
        highlightUserId && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            Team Permissions
          </CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {users.length} members
        </span>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Manage what each team member can access. Permissions control who can
          view, edit, or administer different areas of the platform.
        </p>
        <PermissionsTable
          users={users}
          onUpdatePermission={updatePermission}
          highlightUserId={highlightUserId}
        />
      </CardContent>
    </Card>
  );
}
