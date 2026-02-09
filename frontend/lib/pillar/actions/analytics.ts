/**
 * Analytics Actions for the Pillar Admin app.
 *
 * These actions help users view and analyze help center performance,
 * search analytics, and AI conversation metrics.
 *
 * Data type is automatically inferred from `type: "navigate"` → NavigateActionData
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const analyticsActions = {
  view_search_analytics: {
    description:
      "View search analytics including popular queries, failed searches, and " +
      "search trends. Use when user asks about search analytics, popular searches, " +
      "what people are searching for, or search performance.",
    type: "navigate" as const,
    path: "/analytics/search",
    autoRun: true,
    autoComplete: true,
  },

  view_ai_analytics: {
    description:
      "View AI assistant performance metrics including resolution rate, escalation rate, " +
      "and message volume. Use when user asks about AI analytics, chatbot stats, " +
      "how the AI is performing, or assistant metrics.",
    examples: [
      "how is the AI performing",
      "show AI metrics",
      "chatbot performance stats",
      "AI resolution rate",
    ],
    type: "navigate" as const,
    path: "/analytics/ai",
    autoRun: true,
    autoComplete: true,
  },

  // === Time Range Navigation Actions ===
  // Navigate to analytics with specific date ranges pre-set

  view_analytics_last_7_days: {
    description:
      "View analytics dashboard for the last 7 days. " +
      "Use when user asks about this week's performance, recent metrics, " +
      "or short-term analytics.",
    examples: [
      "show me last 7 days analytics",
      "this week's performance",
      "recent metrics",
    ],
    type: "navigate" as const,
    path: "/analytics?range=7d",
    autoRun: true,
    autoComplete: true,
  },

  view_analytics_last_30_days: {
    description:
      "View analytics dashboard for the last 30 days. " +
      "Use when user asks about this month's performance or monthly metrics.",
    examples: [
      "show me last 30 days analytics",
      "this month's performance",
      "monthly metrics",
    ],
    type: "navigate" as const,
    path: "/analytics?range=30d",
    autoRun: true,
    autoComplete: true,
  },

  view_analytics_last_90_days: {
    description:
      "View analytics dashboard for the last 90 days (quarterly). " +
      "Use when user asks about quarterly performance or longer-term trends.",
    examples: [
      "show me quarterly analytics",
      "last 90 days metrics",
      "3 month performance",
    ],
    type: "navigate" as const,
    path: "/analytics?range=90d",
    autoRun: true,
    autoComplete: true,
  },

  // === Export Actions ===
  // Export analytics data to CSV for external analysis

  export_conversations_csv: {
    description:
      "Export conversations to a CSV file for the specified date range. " +
      "Use when user wants to download conversation data, export chat logs, " +
      "or get analytics data for external analysis.",
    examples: [
      "export conversations to CSV",
      "download conversation data",
      "export chat logs",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        range: {
          type: "string" as const,
          description: "Date range: '7d', '30d', or '90d'",
          enum: ["7d", "30d", "90d"],
        },
      },
    },
    defaultData: { range: "30d" },
  },

  // === Conversation Search ===
  // Navigate to conversations with search pre-filled

  search_conversations: {
    description:
      "Search and filter individual chat conversations by keyword or topic. " +
      "Use when user wants to find specific conversations, look up what users asked about, " +
      "see chats mentioning a topic, or browse conversation history.",
    examples: [
      "show me conversations about billing",
      "find chats where users asked about pricing",
      "search conversations about password reset",
      "what are users asking about",
      "show chats mentioning refunds",
    ],
    type: "navigate" as const,
    autoRun: true,
    autoComplete: true,
    dataSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Search query to find matching conversations",
        },
      },
      required: ["query"],
    },
    defaultData: { query: "" },
  },
} as const satisfies SyncActionDefinitions;
