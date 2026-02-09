/**
 * TanStack Query configuration for organization/team management.
 */

import { organizationAPI } from "@/lib/admin/organization-api";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const organizationKeys = {
  all: ["organization"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: () => [...organizationKeys.all, "detail"] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.detail(id), "members"] as const,
  invitations: (id: string) =>
    [...organizationKeys.detail(id), "invitations"] as const,
  invitationPreview: (token: string) =>
    [...organizationKeys.all, "invitation-preview", token] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * Query for organization members.
 */
export const organizationMembersQuery = (id: string) =>
  queryOptions({
    queryKey: organizationKeys.members(id),
    queryFn: () => organizationAPI.getMembers(id),
  });

/**
 * Query for pending organization invitations.
 * Only available to admins - will return 403 for non-admins.
 */
export const organizationInvitationsQuery = (id: string) =>
  queryOptions({
    queryKey: organizationKeys.invitations(id),
    queryFn: () => organizationAPI.getInvitations(id),
    retry: (failureCount, error: Error & { response?: { status?: number } }) => {
      // Don't retry on 403 Forbidden (user is not an admin)
      if (error?.response?.status === 403) {
        return false;
      }
      // Default retry behavior for other errors (max 3 retries)
      return failureCount < 3;
    },
  });

// =============================================================================
// Mutations
// =============================================================================

/**
 * Mutation to bulk invite members to an organization.
 */
export const bulkInviteMembersMutation = () => ({
  mutationFn: ({
    id,
    emails,
    role,
  }: {
    id: string;
    emails: string[];
    role?: string;
  }) => organizationAPI.bulkInviteMembers(id, emails, role),
});

/**
 * Mutation to remove a member from an organization.
 */
export const removeMemberMutation = () => ({
  mutationFn: ({ id, userId }: { id: string; userId: string }) =>
    organizationAPI.removeMember(id, userId),
});

/**
 * Mutation to cancel a pending invitation.
 */
export const cancelInvitationMutation = () => ({
  mutationFn: ({
    organizationId,
    invitationId,
  }: {
    organizationId: string;
    invitationId: string;
  }) => organizationAPI.cancelInvitation(organizationId, invitationId),
});

/**
 * Mutation to resend an invitation email.
 */
export const resendInvitationMutation = () => ({
  mutationFn: ({
    organizationId,
    invitationId,
  }: {
    organizationId: string;
    invitationId: string;
  }) => organizationAPI.resendInvitation(organizationId, invitationId),
});

/**
 * Query for previewing an invitation (unauthenticated).
 */
export const invitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: organizationKeys.invitationPreview(token),
    queryFn: () => organizationAPI.previewInvitation(token),
    enabled: !!token,
  });

/**
 * Mutation to accept an invitation.
 */
export const acceptInvitationMutation = () => ({
  mutationFn: (token: string) => organizationAPI.acceptInvitation(token),
});

/**
 * Mutation to decline an invitation.
 */
export const declineInvitationMutation = () => ({
  mutationFn: (token: string) => organizationAPI.declineInvitation(token),
});
