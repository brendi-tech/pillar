/**
 * Support Actions for the Pillar Admin app.
 *
 * These are special actions used by the routing system:
 * - escalate: When user wants human support
 * - defer: When AI cannot help
 *
 * Data types are automatically inferred from action `type`.
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const supportActions = {
  escalate: {
    description:
      "Connect user with human support when they request help or have account issues. " +
      "This action is triggered automatically when the AI routes to ESCALATE. " +
      "Contact support@trypillar.com for assistance.",
    examples: [
      "talk to support",
      "speak to a person",
      "contact support",
      "my payment failed",
      "I need help",
    ],
    type: "external_link" as const,
    externalUrl: "mailto:support@trypillar.com",
  },

  defer: {
    description:
      "Fallback action when the AI cannot help with a query. " +
      "This action is triggered automatically when the AI routes to DEFER.",
    examples: [
      "I cannot help with that",
      "outside scope",
      "not related to product",
    ],
    type: "trigger_action" as const,
  },
} as const satisfies SyncActionDefinitions;
