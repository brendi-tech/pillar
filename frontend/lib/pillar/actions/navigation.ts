/**
 * Navigation Actions for the Pillar Admin app.
 *
 * These actions navigate users to different pages in the admin interface.
 * All navigation actions use autoRun=true and autoComplete=true for
 * instant navigation when the AI suggests them.
 *
 * Data type is automatically inferred from `type: "navigate"` → NavigateActionData
 * which includes { highlight_selector?: string; path?: string }
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const navigationActions = {
  // === Main Navigation ===
  open_knowledge: {
    description:
      "Navigate to the Knowledge page to view and manage all connected knowledge sources. " +
      "Use when user asks about knowledge sources, integrations, connected documentation, " +
      "syncing content, or importing articles from external platforms.",
    examples: [
      "open knowledge",
      "go to knowledge",
      "show knowledge sources",
      "view my sources",
      "knowledge page",
    ],
    type: "navigate" as const,
    path: "/knowledge",
    autoRun: true,
    autoComplete: true,
  },

  open_settings: {
    description:
      "Navigate to the Configure page to manage help center appearance, branding, " +
      "AI assistant, and other options. Use when user asks about settings, " +
      "configuration, customization, or preferences.",
    examples: [
      "open settings",
      "go to settings",
      "settings page",
      "show me settings",
      "where are the settings",
    ],
    type: "navigate" as const,
    path: "/configure",
    autoRun: true,
    autoComplete: true,
  },

  open_actions: {
    description:
      "Navigate to the Actions page to view and manage AI-suggested actions. " +
      "Actions are buttons the AI can suggest to users. Use when user asks about " +
      "actions, tasks, automation, or configuring what the AI can do.",
    examples: [
      "open actions",
      "go to actions",
      "view actions",
      "actions page",
      "show me the actions",
    ],
    type: "navigate" as const,
    path: "/actions",
    autoRun: true,
    autoComplete: true,
  },

  open_analytics: {
    description:
      "Navigate to the Analytics dashboard to view help center performance metrics, " +
      "search analytics, and usage statistics. Use when user asks about analytics, " +
      "metrics, statistics, performance, or reports.",
    examples: [
      "open analytics",
      "go to analytics",
      "show analytics",
      "view metrics",
      "analytics dashboard",
    ],
    type: "navigate" as const,
    path: "/analytics",
    autoRun: true,
    autoComplete: true,
  },

  open_configure: {
    description:
      "Navigate to the Configure page to set up and customize the AI assistant behavior, " +
      "prompts, and response settings. Use when user asks about configuring the assistant, " +
      "AI setup, or customizing how the AI responds.",
    examples: [
      "open configure",
      "go to configure",
      "configure the ai",
      "setup ai",
      "customize assistant",
    ],
    type: "navigate" as const,
    path: "/configure",
    autoRun: true,
    autoComplete: true,
  },

  // === Create New ===
  create_new_action: {
    description:
      "Navigate to create a new action that the AI can suggest to users. " +
      "Use when user wants to add a new action, create an automation, " +
      "or define a new task for the AI assistant.",
    examples: [
      "create new action",
      "add an action",
      "new action",
      "create action",
      "add new task",
    ],
    type: "navigate" as const,
    path: "/actions/new",
    autoRun: true,
    autoComplete: true,
  },
} as const satisfies SyncActionDefinitions;
