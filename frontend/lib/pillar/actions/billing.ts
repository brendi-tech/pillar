/**
 * Billing Actions for the Pillar Admin app.
 *
 * These actions help users manage billing settings including
 * viewing plan details, usage, and configuring spending alerts.
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const billingActions = {
  // === Navigation Actions ===
  open_billing: {
    description:
      "Navigate to the Billing page to view subscription plan, usage stats, " +
      "invoices, and payment settings. Use when user asks about billing, " +
      "invoices, subscription, plan details, or payment information.",
    type: "navigate" as const,
    path: "/billing",
    autoRun: true,
    autoComplete: true,
  },

  // === Inline UI Actions ===
  set_usage_alert: {
    description:
      "Configure spending alerts to get notified when monthly usage exceeds a threshold. " +
      "Use when user wants to set up budget alerts, spending notifications, cost limits, " +
      "or be notified when they're about to hit their usage cap.",
    examples: [
      "notify me when spending hits $500",
      "set a usage alert at $1000",
      "alert me when I spend over $500 on Slack",
      "set up a budget alert",
      "warn me before I hit my limit",
    ],
    type: "inline_ui" as const,
    autoRun: false, // Show card for user confirmation
    autoComplete: false,
    defaultData: {
      card_type: "set_usage_alert" as const,
      threshold: 500,
      channel: "email" as "email" | "slack",
    },
    dataSchema: {
      type: "object" as const,
      properties: {
        threshold: {
          type: "number" as const,
          description: "Dollar amount threshold for the alert",
        },
        channel: {
          type: "string" as const,
          description: "Where to send notifications (email or slack)",
          enum: ["email", "slack"],
        },
      },
    },
  },
} as const satisfies SyncActionDefinitions;
