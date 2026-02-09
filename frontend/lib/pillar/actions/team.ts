/**
 * Team Management Actions for the Pillar Admin app.
 *
 * These actions help users manage team members, invitations, and roles
 * within their organization.
 *
 * Data types are automatically inferred from action `type`:
 * - type: "navigate" → NavigateActionData
 * - type: "trigger_action" → TriggerActionData
 * - type: "inline_ui" → InlineUIData
 *
 * Only use `defaultData` when you need custom fields beyond the base type.
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const teamActions = {
  // === Navigation Actions ===
  // No defaultData needed - uses base NavigateActionData
  open_team_settings: {
    description:
      "Navigate to the Team settings page to view and manage team members, " +
      "invitations, and permissions. Use when user asks about team, members, " +
      "users, invites, or wants to manage who has access to the organization.",
    type: "navigate" as const,
    path: "/team",
    autoRun: true,
    autoComplete: true,
  },

  // === Inline UI Actions ===
  // Uses custom defaultData for card-specific fields
  invite_team_member: {
    description:
      "Invite new team members to the organization by email. " +
      "Use when user wants to invite someone, add a user, bring someone onto " +
      "the team, share access with a colleague, or add new members. " +
      "Extract email addresses and role from the user's message.",
    examples: [
      "add john@example.com to my team",
      "invite jane@company.com as an admin",
      "add mduffy@trypillar.com to my team as an admin",
      "invite team members",
      "send an invite to alex@startup.io",
      "add new user to the team",
      "invite someone as a member",
    ],
    type: "inline_ui" as const,
    autoRun: false, // Show card for user confirmation
    autoComplete: false,
    defaultData: {
      card_type: "invite_members" as const, // Maps to registered card renderer
      emails: [] as string[], // AI will populate with extracted emails
      role: "member" as "admin" | "member", // Default role
    },
    dataSchema: {
      type: "object" as const,
      properties: {
        emails: {
          type: "array" as const,
          description: "Email addresses to invite",
        },
        role: {
          type: "string" as const,
          description: "Role for new team members (admin or member)",
          enum: ["admin", "member"],
        },
      },
      required: ["emails"],
    },
    requiredContext: { userRole: "admin" },
  },

  // === View/Filter Actions ===
  // Uses defaultData for custom action field
  view_pending_invitations: {
    description:
      "View all pending team invitations that haven't been accepted yet. " +
      "Use when user asks about outstanding invites, who hasn't joined yet, " +
      "wants to check invitation status, or see pending team invites.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "filter_pending_invitations" as const },
    requiredContext: { userRole: "admin" },
  },

  // === Invitation Management Actions ===
  resend_invitation: {
    description:
      "Resend a pending invitation email to a user who hasn't accepted yet. " +
      "Use when user asks to resend an invite, remind someone about their " +
      "invitation, send another invite email, or nudge a pending invitee.",
    type: "trigger_action" as const,
    autoRun: false, // Sends email - needs confirmation
    autoComplete: false,
    defaultData: { action: "resend_invitation" as const },
    requiredContext: { userRole: "admin" },
  },

  cancel_invitation: {
    description:
      "Cancel a pending invitation so the link no longer works. " +
      "Use when user wants to revoke access before someone accepts, " +
      "cancel an invite, remove a pending invitation, or rescind an invite.",
    type: "trigger_action" as const,
    autoRun: false, // Destructive - needs confirmation
    autoComplete: false,
    defaultData: { action: "cancel_invitation" as const },
    requiredContext: { userRole: "admin" },
  },

  // === Member Management Actions ===
  remove_team_member: {
    description:
      "Remove a user from the organization and revoke their access. " +
      "Use when user wants to remove someone from the team, revoke access, " +
      "delete a team member, or kick someone out. Warning: this is irreversible.",
    type: "trigger_action" as const,
    autoRun: false, // Destructive - needs confirmation
    autoComplete: false,
    defaultData: { action: "remove_member" as const },
    requiredContext: { userRole: "admin" },
  },

  // === Role Management Actions ===
  // These change the user's TEAM ROLE (admin vs member), not resource permissions
  promote_to_admin: {
    description:
      "Promote a team member to organization admin role, giving them ability " +
      "to invite/remove team members. This changes their TEAM ROLE, not " +
      "resource permissions. Use only when user explicitly says 'make admin' " +
      "or 'promote to admin' without mentioning a specific resource.",
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    defaultData: { action: "update_member_role" as const, role: "admin" as const },
  },

  demote_to_member: {
    description:
      "Change an organization admin back to regular member role. This changes " +
      "their TEAM ROLE, not resource permissions. Use only when user explicitly " +
      "says 'demote' or 'remove admin role' without mentioning a specific resource.",
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    defaultData: { action: "update_member_role" as const, role: "member" as const },
  },

  // === Resource Permission Actions ===
  // Inline UI pattern: shows card for user confirmation before updating
  update_user_permissions: {
    description:
      "Update a user's permission level for a specific RESOURCE (production, staging, " +
      "analytics, billing, or team). Use when user mentions a specific resource like " +
      "'production' or 'staging' along with a permission level (admin/edit/view/none). " +
      "This controls what they can do in that specific area, not their team role.",
    examples: [
      "Give Sarah admin access to production",
      "Give Sarah admin on production",
      "Give John admin access to staging",
      "Give Emily admin access to analytics",
      "Give Sarah view access to production",
      "Make John admin on staging",
      "Remove billing access for Alex",
      "Set Michael to edit on team settings",
    ],
    type: "inline_ui" as const,
    autoRun: false, // Show card for user confirmation
    autoComplete: false,
    defaultData: {
      card_type: "update_permissions" as const,
      userName: "" as string,
      resource: "production" as
        | "production"
        | "staging"
        | "analytics"
        | "billing"
        | "team",
      level: "view" as "none" | "view" | "edit" | "admin",
    },
    dataSchema: {
      type: "object" as const,
      properties: {
        userName: {
          type: "string" as const,
          description: "Name or email of the user to update",
        },
        resource: {
          type: "string" as const,
          description: "The resource area to update permissions for",
          enum: ["production", "staging", "analytics", "billing", "team"],
        },
        level: {
          type: "string" as const,
          description: "The permission level to set",
          enum: ["none", "view", "edit", "admin"],
        },
      },
      required: ["userName", "resource", "level"],
    },
  },
} as const satisfies SyncActionDefinitions;
