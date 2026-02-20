"use client";

import { InviteMemberDialog } from "@/components/UserManagementPanel/InviteMemberDialog";
import { getCurrentOrganizationId } from "@/lib/admin/api-client";
import {
  bulkInviteMembersMutation,
  organizationKeys,
} from "@/queries/organization.queries";
import type { BulkInvitationResult, OrganizationRole } from "@/types/organization";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useInviteMembersModal } from "./useInviteMembersModal";

export function InviteMembersModal() {
  const { isOpen, data, close } = useInviteMembersModal();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [bulkInviteResult, setBulkInviteResult] =
    useState<BulkInvitationResult | null>(null);

  // Pre-fill from data when modal opens
  useEffect(() => {
    if (isOpen && data) {
      if (data.emails?.length) {
        setParsedEmails(data.emails);
        setInviteEmail(data.emails.join(", "));
      }
      if (data.role) {
        setInviteRole(data.role);
      }
    }
  }, [isOpen, data]);

  const parseEmails = (text: string): string[] => {
    if (!text.trim()) return [];
    const emails = text
      .split(/[,;\n\s]+/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    return Array.from(new Set(emails));
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailInputChange = (text: string) => {
    setInviteEmail(text);
    const validEmails = parseEmails(text).filter(isValidEmail);
    setParsedEmails(validEmails);
  };

  const removeEmail = (emailToRemove: string) => {
    const updated = parsedEmails.filter((e) => e !== emailToRemove);
    setParsedEmails(updated);
    setInviteEmail(updated.join(", "));
  };

  const organizationId = getCurrentOrganizationId();

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
          handleClose();
        }, 1500);
      }

      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: organizationKeys.members(organizationId),
        });
        queryClient.invalidateQueries({
          queryKey: organizationKeys.invitations(organizationId),
        });
      }
    },
    onError: (err: Error & { response?: { data?: { error?: string; message?: string } } }) => {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to invite members."
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedEmails.length === 0 || !organizationId) return;

    setBulkInviteResult(null);
    bulkInvite.mutate({
      id: organizationId,
      emails: parsedEmails,
      role: inviteRole,
    });
  };

  const handleClose = useCallback(() => {
    close();
    setInviteEmail("");
    setParsedEmails([]);
    setInviteRole("member");
    setBulkInviteResult(null);
  }, [close]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <InviteMemberDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      inviteEmail={inviteEmail}
      parsedEmails={parsedEmails}
      inviteRole={inviteRole}
      domainMismatchWarning={null}
      bulkInviteResult={bulkInviteResult}
      isInviting={bulkInvite.isPending}
      onEmailInputChange={handleEmailInputChange}
      onRemoveEmail={removeEmail}
      onRoleChange={setInviteRole}
      onSubmit={handleSubmit}
    />
  );
}
