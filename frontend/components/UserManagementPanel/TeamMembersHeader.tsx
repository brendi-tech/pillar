"use client";

import { Users } from "lucide-react";

interface TeamMembersHeaderProps {
  membersCount: number;
  invitationsCount: number;
  isAdmin: boolean;
}

export function TeamMembersHeader({
  membersCount,
  invitationsCount,
  isAdmin,
}: TeamMembersHeaderProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Users className="h-4 w-4" />
        <span>
          {membersCount} {membersCount === 1 ? "member" : "members"}
        </span>
      </div>
      {isAdmin && invitationsCount > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          {invitationsCount} pending {invitationsCount === 1 ? "invite" : "invites"}
        </span>
      )}
    </div>
  );
}
