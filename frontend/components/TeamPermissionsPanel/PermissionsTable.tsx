"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MockUser, Resource, PermissionLevel } from "./TeamPermissionsPanel";

interface PermissionsTableProps {
  users: MockUser[];
  onUpdatePermission: (
    userId: string,
    resource: Resource,
    level: PermissionLevel
  ) => void;
  highlightUserId: string | null;
}

const RESOURCES: { key: Resource; label: string }[] = [
  { key: "production", label: "Production" },
  { key: "staging", label: "Staging" },
  { key: "analytics", label: "Analytics" },
  { key: "billing", label: "Billing" },
  { key: "team", label: "Team" },
];

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "admin", label: "Admin" },
];

function getPermissionColors(level: PermissionLevel): string {
  switch (level) {
    case "admin":
      return "bg-primary text-primary-foreground";
    case "edit":
      return "bg-blue-500 text-white dark:bg-blue-600";
    case "view":
      return "bg-emerald-500 text-white dark:bg-emerald-600";
    case "none":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PermissionsTable({
  users,
  onUpdatePermission,
  highlightUserId,
}: PermissionsTableProps) {
  const handlePermissionChange = (
    user: MockUser,
    resource: Resource,
    newLevel: PermissionLevel
  ) => {
    const oldLevel = user.permissions[resource];
    onUpdatePermission(user.id, resource, newLevel);
    toast.success(`Updated ${user.name}'s ${resource} permission`, {
      description: `Changed from ${oldLevel} to ${newLevel}`,
    });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Member</TableHead>
            {RESOURCES.map((resource) => (
              <TableHead key={resource.key} className="text-center">
                {resource.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              className={cn(
                "transition-all duration-500",
                highlightUserId === user.id &&
                  "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              {RESOURCES.map((resource) => {
                const currentLevel = user.permissions[resource.key];
                return (
                  <TableCell key={resource.key} className="text-center">
                    <Select
                      value={currentLevel}
                      onValueChange={(value) =>
                        handlePermissionChange(
                          user,
                          resource.key,
                          value as PermissionLevel
                        )
                      }
                    >
                      <SelectTrigger className="mx-auto h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                        <span
                          className={cn(
                            "inline-flex min-w-[56px] cursor-pointer items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                            getPermissionColors(currentLevel)
                          )}
                        >
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent align="center">
                        {PERMISSION_LEVELS.map((level) => (
                          <SelectItem
                            key={level.value}
                            value={level.value}
                            className="justify-center"
                          >
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
