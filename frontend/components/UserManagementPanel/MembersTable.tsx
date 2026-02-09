import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationRole,
} from "@/types/organization";
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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((membership) => (
          <MemberRow
            key={`member-${membership.id}`}
            membership={membership}
            isCurrentUser={membership.user.id === currentUserId}
            isAdmin={isAdmin}
            isRemoving={isRemoving}
            onRemove={onRemoveMember}
            getRoleBadgeColor={getRoleBadgeColor}
          />
        ))}
        {isAdmin &&
          invitations.map((invitation) => (
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
          ))}
      </TableBody>
    </Table>
  );
}
