/**
 * Settings Actions for the Pillar Admin app.
 *
 * These actions help users configure various aspects of their help center,
 * including theme, branding, AI assistant, and feature toggles.
 *
 * Data types are automatically inferred from action `type`:
 * - type: "navigate" → NavigateActionData { highlight_selector?, path? }
 * - type: "trigger_action" → TriggerActionData { action?, ... }
 *
 * Only use `defaultData` when you need custom fields beyond the base type.
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

export const settingsActions = {
  // === Feature Toggles (trigger_action) ===
  // These use defaultData for custom fields beyond base TriggerActionData
  enable_ai_assistant: {
    description:
      "Enable the AI chat assistant widget so users can ask questions and get " +
      "AI-powered answers. Use when user wants to turn on, enable, or activate " +
      "the AI assistant or chatbot.",
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    defaultData: { action: "enable_ai", target: "ai_assistant" },
  },

  disable_ai_assistant: {
    description:
      "Disable the AI chat assistant widget to hide it from users. Use when user " +
      "wants to turn off, disable, or deactivate the AI assistant or chatbot.",
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    defaultData: { action: "disable_ai", target: "ai_assistant" },
  },

  enable_dark_mode: {
    description:
      "Switch to dark mode / dark theme. Use when user explicitly wants to " +
      "turn ON dark mode, enable dark mode, or switch TO dark theme.",
    examples: [
      "enable dark mode",
      "turn on dark mode",
      "switch to dark",
      "dark theme",
      "go dark",
    ],
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "set_theme" as const, theme: "dark" as const },
  },

  disable_dark_mode: {
    description:
      "Switch to light mode / disable dark theme. Use when user explicitly wants to " +
      "turn OFF dark mode, disable dark mode, or switch TO light theme/mode.",
    examples: [
      "disable dark mode",
      "turn off dark mode",
      "switch to light",
      "light mode",
      "go light",
    ],
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "set_theme" as const, theme: "light" as const },
  },

  toggle_dark_mode: {
    description:
      "Toggle between dark and light mode. Use when user asks to 'toggle dark mode', " +
      "'switch theme', 'change to dark/light', or generally wants to flip their current " +
      "theme without specifying which one they want.",
    examples: ["toggle dark mode", "switch theme", "toggle theme", "change theme"],
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "toggle_theme" as const },
  },

  change_theme: {
    description:
      "Open the theme selector to switch to a different visual theme preset. " +
      "Use when user wants to change theme, switch themes, or try a different look.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "open_theme_selector" as const },
  },

  update_logo: {
    description:
      "Open the logo uploader to change or update the help center logo. Use when " +
      "user wants to upload a new logo, change the logo, or update branding image.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "open_logo_uploader" as const },
  },

  add_footer_link: {
    description:
      "Add a new link to the help center footer. Use when user wants to add a " +
      "footer link, add bottom navigation, or include additional links in footer.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "add_footer_link" as const },
  },

  configure_suggested_questions: {
    description:
      "Configure the suggested questions that appear in the AI chat widget. " +
      "Use when user wants to set up suggested questions, conversation starters, " +
      "or example questions for the AI.",
    type: "trigger_action" as const,
    autoRun: true,
    autoComplete: true,
    defaultData: { action: "configure_suggested_questions" as const },
  },

  // === Settings Autosave Actions ===
  // These actions directly update settings and save immediately

  update_brand_name: {
    description:
      "Update the brand name displayed in the help center. " +
      "Use when user wants to change their company name, brand name, " +
      "or help center title. This saves immediately.",
    examples: [
      "change my brand name to Acme",
      "set company name to TechCorp",
      "update the title to My Help Center",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "The new brand name to display",
        },
      },
      required: ["name"],
    },
  },

  update_ai_assistant_name: {
    description:
      "Update the AI assistant's display name shown in the chat widget. " +
      "Use when user wants to rename the chatbot, change the assistant name, " +
      "or personalize the AI identity. This saves immediately.",
    examples: [
      "call my AI assistant Luna",
      "rename the chatbot to Helper",
      "change assistant name to Support Bot",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "The new name for the AI assistant",
        },
      },
      required: ["name"],
    },
  },

  update_ai_welcome_message: {
    description:
      "Update the welcome message shown when users open the AI chat. " +
      "Use when user wants to change the greeting, update the intro message, " +
      "or customize how the AI introduces itself. This saves immediately.",
    examples: [
      "set welcome message to Hi! How can I help?",
      "change the greeting to Welcome to our help center",
      "update the intro message",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "The new welcome message to display",
        },
      },
      required: ["message"],
    },
  },

  set_suggested_questions: {
    description:
      "Set the suggested questions that appear in the AI chat widget. " +
      "Use when user wants to configure starter questions, conversation starters, " +
      "or example queries. This saves immediately.",
    examples: [
      "set starter questions to How do I get started, What are the pricing plans",
      "add suggested questions",
      "update the example questions",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array" as const,
          description: "List of suggested questions (3-5 recommended)",
          items: { type: "string" as const },
        },
      },
      required: ["questions"],
    },
  },

  update_primary_color: {
    description:
      "Update the primary/accent color used throughout the help center. " +
      "Use when user wants to change their brand color, theme color, " +
      "accent color, or primary color. Convert any color name the user " +
      "mentions to a hex code before calling. This saves immediately.",
    examples: [
      "change my color to green",
      "set primary color to #FF5733",
      "update the accent color to blue",
      "make the theme color red",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        hex: {
          type: "string" as const,
          description:
            "Hex color code including the # prefix (e.g. #22c55e for green, #3b82f6 for blue). " +
            "Always convert color names to hex before calling.",
        },
      },
      required: ["hex"],
    },
  },

  update_fallback_message: {
    description:
      "Update the fallback message shown when the AI cannot answer a question. " +
      "Use when user wants to customize what happens when the AI doesn't know, " +
      "or change the escalation message. This saves immediately.",
    examples: [
      "set fallback message to Let me connect you with support",
      "change what the AI says when it doesn't know",
      "update the I don't know response",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "The new fallback message to display",
        },
      },
      required: ["message"],
    },
  },
} as const satisfies SyncActionDefinitions;
