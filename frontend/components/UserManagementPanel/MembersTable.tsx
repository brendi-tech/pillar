"use client";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/DataTable";
import type {
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationRole,
} from "@/types/organization";
import { useMemo } from "react";
import { InvitationRow } from "./InvitationRow";
import { MemberRow } from "./MemberRow";

interface MembersTableProps {
  members: OrganizationMembership[];
  invitations: OrganizationInvitation[];
  currentUserId?: string;
  isAdmin: boolean;
  isRemoving: boolean;
  isResending: boolean;
  isCanceling: boolean;
  onRemoveMember: (member: OrganizationMembership) => void;
  onCopyInvitationLink: (link: string) => void;
  onResendInvitation: (id: string) => void;
  onCancelInvitation: (id: string) => void;
  getRoleBadgeColor: (role: OrganizationRole) => string;
}

export function MembersTable({
  members,
  invitations,
  currentUserId,
  isAdmin,
  isRemoving,
  isResending,
  isCanceling,
  onRemoveMember,
  onCopyInvitationLink,
  onResendInvitation,
  onCancelInvitation,
  getRoleBadgeColor,
}: MembersTableProps) {
  const columns = useMemo(() => {
    const base: DataTableColumn<OrganizationMembership>[] = [
      { id: "name", header: "Name", cell: () => null },
      { id: "email", header: "Email", cell: () => null },
      { id: "role", header: "Role", width: "w-[100px]", cell: () => null },
      { id: "joined", header: "Joined", width: "w-[120px]", cell: () => null },
    ];
    if (isAdmin) {
      base.push({
        id: "actions",
        header: "Actions",
        width: "w-[120px]",
        headerClassName: "text-right",
        cell: () => null,
      });
    }
    return base;
  }, [isAdmin]);

  const invitationRows = isAdmin
    ? invitations.map((invitation) => (
        <InvitationRow
          key={`invitation-${invitation.id}`}
          invitation={invitation}
          isResending={isResending}
          isCanceling={isCanceling}
          onCopyLink={onCopyInvitationLink}
          onResend={onResendInvitation}
          onCancel={onCancelInvitation}
          getRoleBadgeColor={getRoleBadgeColor}
        />
      ))
    : null;

  return (
    <DataTable
      columns={columns}
      data={members}
      keyExtractor={(row) => `member-${row.id}`}
      renderRow={(membership) => (
        <MemberRow
          key={`member-${membership.id}`}
          membership={membership}
          isCurrentUser={membership.user.id === currentUserId}
          isAdmin={isAdmin}
          isRemoving={isRemoving}
          onRemove={onRemoveMember}
          getRoleBadgeColor={getRoleBadgeColor}
        />
      )}
      extraRows={invitationRows}
    />
  );
}
