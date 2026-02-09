/**
 * Organization API client for team management.
 * Handles members, invitations, and team-related operations.
 */

import type {
  BulkInvitationResult,
  InvitationPreview,
  OrganizationInvitation,
  OrganizationMembership,
} from "@/types/organization";
import { apiClient } from "./api-client";

export const organizationAPI = {
  /**
   * Get all members of an organization.
   */
  getMembers: async (id: string): Promise<OrganizationMembership[]> => {
    const response = await apiClient.get(
      `/api/users/organizations/${id}/members/`
    );
    return response.data;
  },

  /**
   * Invite a single member to the organization.
   */
  inviteMember: async (
    id: string,
    email: string,
    role?: string
  ): Promise<OrganizationInvitation> => {
    const response = await apiClient.post(
      `/api/users/organizations/${id}/invite_member/`,
      {
        email,
        role: role || "member",
      }
    );
    return response.data;
  },

  /**
   * Bulk invite multiple members to the organization.
   */
  bulkInviteMembers: async (
    id: string,
    emails: string[],
    role?: string
  ): Promise<BulkInvitationResult> => {
    const response = await apiClient.post(
      `/api/users/organizations/${id}/bulk-invite-members/`,
      {
        emails,
        role: role || "member",
      }
    );
    return response.data;
  },

  /**
   * Remove a member from the organization.
   */
  removeMember: async (id: string, userId: string): Promise<void> => {
    await apiClient.delete(`/api/users/organizations/${id}/remove_member/`, {
      data: { user_id: userId },
    });
  },

  /**
   * Get pending invitations for an organization.
   */
  getInvitations: async (id: string): Promise<OrganizationInvitation[]> => {
    const response = await apiClient.get(
      `/api/users/organizations/${id}/invitations/`
    );
    return response.data;
  },

  /**
   * Cancel a pending invitation.
   */
  cancelInvitation: async (
    organizationId: string,
    invitationId: string
  ): Promise<void> => {
    await apiClient.delete(
      `/api/users/organizations/${organizationId}/invitations/${invitationId}/`
    );
  },

  /**
   * Resend an invitation email.
   */
  resendInvitation: async (
    organizationId: string,
    invitationId: string
  ): Promise<OrganizationInvitation> => {
    const response = await apiClient.post(
      `/api/users/organizations/${organizationId}/invitations/${invitationId}/resend/`
    );
    return response.data;
  },

  /**
   * Preview an invitation (unauthenticated - anyone with the token can view).
   */
  previewInvitation: async (token: string): Promise<InvitationPreview> => {
    const response = await apiClient.get(
      `/api/users/organizations/preview_invitation/`,
      { params: { token } }
    );
    return response.data;
  },

  /**
   * Accept an invitation.
   */
  acceptInvitation: async (token: string): Promise<void> => {
    await apiClient.post(`/api/users/organizations/accept_invitation/`, {
      token,
    });
  },

  /**
   * Decline an invitation.
   */
  declineInvitation: async (token: string): Promise<void> => {
    await apiClient.post(`/api/users/organizations/decline_invitation/`, {
      token,
    });
  },
};
