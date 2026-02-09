/**
 * Query Actions for the Pillar Admin app.
 *
 * These actions return data for the agent to use in further reasoning.
 * They help the agent make context-aware decisions like:
 * - Check what sources exist before suggesting source-related actions
 * - Get sync status before offering to resync
 * - List team members before suggesting team management actions
 *
 * Query actions have `returns: true` which tells the SDK to send
 * the handler's return value back to the agent.
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

/**
 * Query action definitions.
 * These actions return data instead of performing operations.
 */
export const queryActions = {
  /**
   * Get the list of configured knowledge sources.
   * Agent calls this before suggesting source-specific actions.
   */
  list_sources: {
    description:
      "Get the list of configured knowledge sources. " +
      "Returns source IDs, names, types, and sync status. " +
      "Call this before suggesting source-specific actions to know what exists. " +
      "Example: Before suggesting 'crawl website', check if a website source exists.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get detailed sync status for a specific source.
   * Useful for providing sync progress or troubleshooting.
   */
  get_source_sync_status: {
    description:
      "Get detailed sync status for a knowledge source. " +
      "Returns last sync time, document count, errors, and progress. " +
      "Call this when user asks about sync status or content freshness.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
    dataSchema: {
      type: "object" as const,
      properties: {
        source_id: {
          type: "string" as const,
          description: "The source ID to check (from list_sources)",
        },
      },
      required: ["source_id"],
    },
  },

  /**
   * Get the list of team members and pending invitations.
   * Agent calls this before suggesting team management actions.
   */
  list_team_members: {
    description:
      "Get the list of team members and pending invitations. " +
      "Returns member emails, roles, and status. " +
      "Call this before suggesting invite or role-change actions.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get the overall help center setup status.
   * Useful for onboarding guidance.
   */
  get_help_center_status: {
    description:
      "Get the overall help center setup status. " +
      "Returns what's configured and what's missing. " +
      "Call this when helping with initial setup or onboarding.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get the list of custom instruction snippets.
   * Agent calls this to understand what behavior customizations are configured.
   */
  list_snippets: {
    description:
      "Get the list of custom instruction snippets. " +
      "Returns snippet titles and excerpts. " +
      "Call this when user asks about custom instructions or AI behavior customization.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get AI conversation statistics for recent activity.
   * Useful for reporting on usage and performance.
   */
  get_conversation_stats: {
    description:
      "Get AI conversation statistics for the past 30 days. " +
      "Returns total conversations, resolution rate, feedback, and top questions. " +
      "Call this when user asks about usage, performance, or analytics.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get the current product configuration.
   * Useful for answering questions about settings.
   */
  get_product_settings: {
    description:
      "Get the current product configuration. " +
      "Returns brand name, features enabled, and AI settings. " +
      "Call this when user asks about settings or configuration.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },

  /**
   * Get the list of defined actions for this product.
   * Useful for the agent to understand its capabilities.
   */
  list_actions: {
    description:
      "Get the list of defined actions for this product. " +
      "Returns action names, descriptions, and types. " +
      "Call this when user asks what you can do or what actions are available.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    returns: true,
  },
} as const satisfies SyncActionDefinitions;
