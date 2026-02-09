// ============================================================================
// Organization & Team Management Types
// ============================================================================

/**
 * User summary for displaying in membership/invitation contexts.
 */
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

/**
 * Organization roles - 'owner' is legacy and converted to 'admin' in backend.
 */
export type OrganizationRole = 'admin' | 'member' | 'owner';

/**
 * Organization membership - represents a user's membership in an organization.
 */
export interface OrganizationMembership {
  id: string;
  user: UserSummary;
  role: OrganizationRole;
  invited_by?: string | null;
  invitation_accepted_at?: string | null;
  created_at: string;
}

/**
 * Invitation status for organization invitations.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Organization summary for invitation contexts.
 */
export interface OrganizationSummary {
  id: string;
  name: string;
  domain?: string | null;
}

/**
 * Organization invitation - pending invitation to join an organization.
 */
export interface OrganizationInvitation {
  id: string;
  organization: OrganizationSummary;
  email: string;
  role: OrganizationRole;
  invited_by: UserSummary;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  created_at: string;
  updated_at: string;
  is_valid: boolean;
  invitation_link: string;
}

/**
 * Preview of an invitation (for unauthenticated users).
 */
export interface InvitationPreview {
  email: string;
  role: OrganizationRole;
  invited_by: UserSummary;
  organization: OrganizationSummary;
  expires_at: string;
  created_at: string;
  is_valid: boolean;
  user_exists: boolean;
}

/**
 * Skipped invitation in bulk invite response.
 */
export interface SkippedInvitation {
  email: string;
  reason: string;
}

/**
 * Failed invitation in bulk invite response.
 */
export interface FailedInvitation {
  email: string;
  error: string;
}

/**
 * Result of a bulk invitation operation.
 */
export interface BulkInvitationResult {
  successful: OrganizationInvitation[];
  skipped: SkippedInvitation[];
  errors: FailedInvitation[];
}
