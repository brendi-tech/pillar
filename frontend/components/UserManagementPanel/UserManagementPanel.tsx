"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
import { WarningModal } from "@/components/WarningModal";
import { useAuth } from "@/providers/AuthProvider";
import {
  bulkInviteMembersMutation,
  cancelInvitationMutation,
  organizationInvitationsQuery,
  organizationKeys,
  organizationMembersQuery,
  removeMemberMutation,
  resendInvitationMutation,
} from "@/queries/organization.queries";
import type {
  BulkInvitationResult,
  OrganizationRole,
} from "@/types/organization";

import { InviteMemberDialog } from "./InviteMemberDialog";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { MemberNotice } from "./MemberNotice";
import { MembersTable } from "./MembersTable";
import { TeamMembersHeader } from "./TeamMembersHeader";

interface UserManagementPanelProps {
  organizationId: string;
}

export function UserManagementPanel({
  organizationId,
}: UserManagementPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [bulkInviteResult, setBulkInviteResult] =
    useState<BulkInvitationResult | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const {
    data: members = [],
    isPending: isMembersPending,
    isError: isMembersError,
    error: membersError,
  } = useQuery(organizationMembersQuery(organizationId));

  const currentUserMembership = members.find((m) => m.user.id === user?.id);
  const isAdmin =
    currentUserMembership?.role === "admin" ||
    currentUserMembership?.role === "owner";

  const {
    data: allInvitations = [],
    isPending: isInvitationsPending,
    isError: isInvitationsError,
    error: invitationsError,
  } = useQuery({
    ...organizationInvitationsQuery(organizationId),
    enabled: isAdmin,
  });

  const showInvitationsPending = isAdmin && isInvitationsPending;
  const isForbiddenError =
    isInvitationsError &&
    (invitationsError as Error & { response?: { status?: number } })?.response
      ?.status === 403;
  const invitations = allInvitations.filter((inv) => inv.status === "pending");

  const parseEmails = (text: string): string[] => {
    if (!text.trim()) return [];
    const emails = text
      .split(/[,;\n\s]+/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    return Array.from(new Set(emails));
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailInputChange = (text: string) => {
    setInviteEmail(text);
    const emails = parseEmails(text);
    const validEmails = emails.filter(isValidEmail);
    setParsedEmails(validEmails);
  };

  const removeEmail = (emailToRemove: string) => {
    const updatedEmails = parsedEmails.filter(
      (email) => email !== emailToRemove
    );
    setParsedEmails(updatedEmails);
    setInviteEmail(updatedEmails.join(", "));
  };

  const bulkInvite = useMutation({
    ...bulkInviteMembersMutation(),
    onSuccess: (result) => {
      setBulkInviteResult(result);

      if (result.successful.length > 0) {
        toast.success(
          `Successfully invited ${result.successful.length} ${result.successful.length === 1 ? "member" : "members"}!`
        );
      }

      if (result.skipped.length > 0) {
        toast.warning(
          `${result.skipped.length} ${result.skipped.length === 1 ? "email was" : "emails were"} skipped`
        );
      }

      if (result.errors.length > 0) {
        toast.error(
          `${result.errors.length} ${result.errors.length === 1 ? "invitation" : "invitations"} failed`
        );
      }

      if (result.errors.length === 0 && result.skipped.length === 0) {
        setTimeout(() => {
          setIsInviteDialogOpen(false);
          setInviteEmail("");
          setParsedEmails([]);
          setInviteRole("member");
          setBulkInviteResult(null);
        }, 1500);
      }

      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      });
    },
    onError: (
      err: Error & {
        response?: { data?: { error?: string; message?: string } };
      }
    ) => {
      console.error("Failed to invite members:", err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to invite members."
      );
    },
  });

  const removeMember = useMutation({
    ...removeMemberMutation(),
    onSuccess: () => {
      setIsRemoveDialogOpen(false);
      setMemberToRemove(null);
      toast.success("Member removed successfully");
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      });
    },
    onError: (
      err: Error & {
        response?: { data?: { error?: string; message?: string } };
      }
    ) => {
      console.error("Failed to remove member:", err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to remove member. You may not have permission to perform this action."
      );
    },
  });

  const cancelInvitation = useMutation({
    ...cancelInvitationMutation(),
    onSuccess: () => {
      toast.success("Invitation canceled successfully");
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      });
    },
    onError: (
      err: Error & {
        response?: { data?: { error?: string; message?: string } };
      }
    ) => {
      console.error("Failed to cancel invitation:", err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to cancel invitation."
      );
    },
  });

  const resendInvitation = useMutation({
    ...resendInvitationMutation(),
    onSuccess: () => {
      toast.success("Invitation email resent successfully!");
    },
    onError: (
      err: Error & {
        response?: { data?: { error?: string; message?: string } };
      }
    ) => {
      console.error("Failed to resend invitation:", err);
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to resend invitation."
      );
    },
  });

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedEmails.length === 0) return;

    setBulkInviteResult(null);
    bulkInvite.mutate({
      id: organizationId,
      emails: parsedEmails,
      role: inviteRole,
    });
  };

  const handleRemoveMember = (member: {
    id: string;
    user: { id: string; full_name: string; email: string };
  }) => {
    setMemberToRemove({
      id: member.user.id,
      name: member.user.full_name,
      email: member.user.email,
    });
    setIsRemoveDialogOpen(true);
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;
    removeMember.mutate({
      id: organizationId,
      userId: memberToRemove.id,
    });
  };

  const handleCancelInvitation = (invitationId: string) => {
    cancelInvitation.mutate({
      organizationId,
      invitationId,
    });
  };

  const handleCopyInvitationLink = async (invitationLink: string) => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      toast.success("Invitation link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy invitation link:", err);
      toast.error("Failed to copy invitation link");
    }
  };

  const handleResendInvitation = (invitationId: string) => {
    resendInvitation.mutate({
      organizationId,
      invitationId,
    });
  };

  const getRoleBadgeColor = (role: OrganizationRole) => {
    switch (role) {
      case "admin":
        return "bg-primary/10 text-primary border-primary/20";
      case "member":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
      default:
        return "bg-muted/50 text-muted-foreground border-border";
    }
  };

  const handleInviteDialogChange = (open: boolean) => {
    setIsInviteDialogOpen(open);
    if (!open) {
      setInviteEmail("");
      setParsedEmails([]);
      setInviteRole("member");
      setBulkInviteResult(null);
    }
  };

  if (isMembersPending || showInvitationsPending) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-hidden p-page max-w-page mx-auto">
        <PageHeader
          title="Team"
          description="Manage your team members and permissions"
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (isMembersError) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-hidden p-page max-w-page mx-auto">
        <PageHeader
          title="Team"
          description="Manage your team members and permissions"
        />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {membersError?.message || "Failed to load team members"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden p-page max-w-page mx-auto">
      <PageHeader
        title="Team"
        description="Manage your team members and permissions"
        actions={
          isAdmin && (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              Invite Member
            </Button>
          )
        }
      />

      {!isAdmin && <MemberNotice />}

      {isForbiddenError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Admin Access Required
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-500">
                You need admin permissions to view and manage team invitations.
                Please contact your organization administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      <TeamMembersHeader
        membersCount={members.length}
        invitationsCount={invitations.length}
        isAdmin={isAdmin}
      />

      <div className="flex-1 overflow-hidden">
        <MembersTable
          members={members}
          invitations={invitations}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          isRemoving={removeMember.isPending}
          isResending={resendInvitation.isPending}
          isCanceling={cancelInvitation.isPending}
          onRemoveMember={handleRemoveMember}
          onCopyInvitationLink={handleCopyInvitationLink}
          onResendInvitation={handleResendInvitation}
          onCancelInvitation={handleCancelInvitation}
          getRoleBadgeColor={getRoleBadgeColor}
        />
      </div>

      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={handleInviteDialogChange}
        inviteEmail={inviteEmail}
        parsedEmails={parsedEmails}
        inviteRole={inviteRole}
        domainMismatchWarning={null}
        bulkInviteResult={bulkInviteResult}
        isInviting={bulkInvite.isPending}
        onEmailInputChange={handleEmailInputChange}
        onRemoveEmail={removeEmail}
        onRoleChange={setInviteRole}
        onSubmit={handleInviteMember}
      />

      <WarningModal
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        onConfirm={confirmRemoveMember}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${memberToRemove?.name} (${memberToRemove?.email}) from the organization? This action cannot be undone.`}
        variant="delete"
        isLoading={removeMember.isPending}
      />
    </div>
  );
}
