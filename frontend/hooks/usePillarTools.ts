"use client";

/**
 * usePillarTools Hook
 *
 * Registers all Pillar tools with co-located metadata and handlers.
 * Uses the new usePillarTool hook that supports multiple tools.
 *
 * Tools are auto-discovered by the sync CLI via:
 *   npx pillar-sync --scan ./hooks/usePillarTools.ts
 *
 * @example
 * ```tsx
 * // In PillarRouteSync component
 * function PillarRouteSync() {
 *   usePillarTools();
 *   return null;
 * }
 * ```
 */

import {
  show as showIntercom,
  showNewMessage as showIntercomWithMessage,
} from "@intercom/messenger-js-sdk";
import { usePillarContext, usePillarTool } from "@pillar-ai/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { openApiKeysModal } from "@/components/ApiKeysModal";
import { openInviteMembersModal } from "@/components/InviteMembersModal";
import { openThemeSelectorModal } from "@/components/ThemeSelectorModal";
import { actionsAPI } from "@/lib/admin/actions-api";
import {
  analyticsAPI,
  getDateRangeFromPreset,
} from "@/lib/admin/analytics-api";
import { adminFetch, adminPatch, getCurrentOrganizationId } from "@/lib/admin/api-client";
import { snippetsAPI } from "@/lib/admin/knowledge-api";
import { organizationAPI } from "@/lib/admin/organization-api";
import { knowledgeSourcesAPI } from "@/lib/admin/sources-api";
import { navigateAndHighlight } from "@/lib/highlight";
import { useProduct } from "@/providers/ProductProvider";
import { configKeys } from "@/queries/config.queries";
import { executeAddAllowedDomain } from "./addAllowedDomain";

/**
 * Extract a human-readable feature name from the current path
 */
function getFeatureName(path: string): string {
  const featureMap: Record<string, string> = {
    "/knowledge": "Knowledge",
    "/tools": "tools",
    "/settings": "Settings",
    "/team": "Team",
    "/configure": "Configure",
    "/analytics": "Analytics",
    "/billing": "Billing",
  };

  if (featureMap[path]) {
    return featureMap[path];
  }

  for (const [prefix, name] of Object.entries(featureMap)) {
    if (path.startsWith(prefix)) {
      return name;
    }
  }

  return "Knowledge";
}

/**
 * Hook that registers all Pillar tools with co-located metadata and handlers.
 * Must be called within PillarProvider context.
 */
export function usePillarTools() {
  const { pillar } = usePillarContext();
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme: setNextTheme } = useTheme();
  const { currentProduct } = useProduct();
  const queryClient = useQueryClient();

  // Helper to navigate with optional highlight
  const nav = useCallback(
    (path: string, highlight?: string) => {
      navigateAndHighlight(router, path, highlight);
    },
    [router]
  );

  // =========================================================================
  // Event Listeners (UI events, not AI-invoked tools)
  // =========================================================================
  useEffect(() => {
    if (!pillar) return;

    const unsubscribers: (() => void)[] = [];

    // Sidebar Tab Click Handler - fires when user clicks a sidebar tab
    unsubscribers.push(
      pillar.on("sidebar:click", ({ tabId }) => {
        if (tabId === "support") {
          pillar.close();
          showIntercom();
        }
      })
    );

    // Generic Navigation Handler - fallback for navigate-type tools
    unsubscribers.push(
      pillar.onTask("navigate", (data) => {
        const path = data.path;
        const highlight = data.highlight_selector as string | undefined;
        if (typeof path === "string") {
          nav(path, highlight);
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [pillar, pathname, nav]);

  // =========================================================================
  // Support tools
  // =========================================================================
  usePillarTool({
    name: "escalate",
    type: "external_link",
    description:
      "Connect user with human support when they request help or have account issues. " +
      "Use when user explicitly asks to talk to a person, contact support, or has issues " +
      "that require human assistance like billing problems or account access.",
    examples: [
      "talk to support",
      "speak to a person",
      "contact support",
      "my payment failed",
      "I need help from a human",
    ],
    autoRun: false,
    autoComplete: false,
    execute: () => {
      const currentPage = pathname || window.location.pathname;
      const pageContext = getFeatureName(currentPage);
      const chatContext = pillar?.getChatContext();

      let prefilledMessage = `Hi! I was using the AI assistant on the ${pageContext} page (${currentPage}) and need some help from a human.`;

      if (chatContext && chatContext.messages.length > 0) {
        const conversationSummary = chatContext.messages
          .slice(-6)
          .map((m) => {
            const prefix = m.role === "user" ? "Me" : "AI";
            return `${prefix}: ${m.content}`;
          })
          .join("\n");

        prefilledMessage += `\n\n--- Conversation with AI ---\n${conversationSummary}`;
      }

      showIntercomWithMessage(prefilledMessage);
    },
  });

  // =========================================================================
  // Navigation tools
  // =========================================================================
  usePillarTool([
    {
      name: "open_knowledge",
      type: "navigate",
      webMCP: true,
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
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/knowledge", data.highlight_selector);
      },
    },
    {
      name: "open_settings",
      webMCP: true,
      type: "navigate",
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
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/configure", data.highlight_selector);
      },
    },
    {
      name: "open_tools",
      type: "navigate",
      description:
        "Navigate to the tools page to view and manage AI-suggested tools. " +
        "tools are buttons the AI can suggest to users. Use when user asks about " +
        "tools, tasks, automation, or configuring what the AI can do.",
      examples: [
        "open tools",
        "go to tools",
        "view tools",
        "tools page",
        "show me the tools",
      ],
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/tools", data.highlight_selector);
      },
    },
    {
      name: "open_analytics",
      type: "navigate",
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
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/analytics", data.highlight_selector);
      },
    },
    {
      name: "open_configure",
      type: "navigate",
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
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/configure", data.highlight_selector);
      },
    },
    {
      name: "create_new_tool",
      type: "navigate",
      description:
        "Navigate to create a new tool that the AI can suggest to users. " +
        "Use when user wants to add a new tool, create an automation, " +
        "or define a new task for the AI assistant.",
      examples: [
        "create new tool",
        "add an tool",
        "new tool",
        "create tool",
        "add new task",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/tools/new");
      },
    },
  ]);

  // =========================================================================
  // Settings tools
  // =========================================================================
  usePillarTool([
    {
      name: "change_theme",
      type: "open_modal",
      description:
        "Open the theme selector to switch to a different visual theme preset. " +
        "Use when user wants to change theme, switch themes, or try a different look.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        openThemeSelectorModal();
      },
    },
    {
      name: "enable_ai_assistant",
      type: "navigate",
      description:
        "Enable the AI chat assistant widget so users can ask questions and get " +
        "AI-powered answers. Use when user wants to turn on, enable, or activate " +
        "the AI assistant or chatbot.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/configure#ai");
      },
    },
    {
      name: "disable_ai_assistant",
      type: "navigate",
      description:
        "Disable the AI chat assistant widget to hide it from users. Use when user " +
        "wants to turn off, disable, or deactivate the AI assistant or chatbot.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/configure#ai");
      },
    },
    {
      name: "update_logo",
      type: "navigate",
      description:
        "Open the logo uploader to change or update the help center logo. Use when " +
        "user wants to upload a new logo, change the logo, or update branding image.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/configure#branding");
      },
    },
    {
      name: "add_footer_link",
      type: "navigate",
      description:
        "Add a new link to the help center footer. Use when user wants to add a " +
        "footer link, add bottom navigation, or include additional links in footer.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/configure#footer");
      },
    },
    {
      name: "configure_suggested_questions",
      type: "navigate",
      description:
        "Configure the suggested questions that appear in the AI chat widget. " +
        "Use when user wants to set up suggested questions, conversation starters, " +
        "or example questions for the AI.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/configure#ai");
      },
    },
    {
      name: "enable_dark_mode",
      type: "trigger_tool",
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
      autoRun: true,
      autoComplete: true,
      execute: () => {
        setNextTheme("dark");
      },
    },
    {
      name: "disable_dark_mode",
      type: "trigger_tool",
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
      autoRun: true,
      autoComplete: true,
      execute: () => {
        setNextTheme("light");
      },
    },
    {
      name: "toggle_dark_mode",
      type: "trigger_tool",
      description:
        "Toggle between dark and light mode. Use when user asks to 'toggle dark mode', " +
        "'switch theme', 'change to dark/light', or generally wants to flip their current " +
        "theme without specifying which one they want.",
      examples: [
        "toggle dark mode",
        "switch theme",
        "toggle theme",
        "change theme",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        const currentTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        setNextTheme(currentTheme === "dark" ? "light" : "dark");
      },
    },
  ]);

  // =========================================================================
  // Settings Autosave tools
  // =========================================================================
  usePillarTool([
    {
      name: "update_brand_name",
      type: "trigger_tool",
      description:
        "Update the brand name displayed in the help center. " +
        "Use when user wants to change their company name, brand name, " +
        "or help center title. This saves immediately.",
      examples: [
        "change my brand name to Acme",
        "set company name to TechCorp",
        "update the title to My Help Center",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The new brand name to display",
          },
        },
        required: ["name"],
      },
      execute: async (data: { name?: string }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const name = data.name;
        if (!name?.trim()) {
          return { success: false, error: "Name is required" };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              branding: {
                ...currentProduct.config?.branding,
                name: name.trim(),
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return { success: true, message: `Brand name updated to "${name}"` };
        } catch {
          return { success: false, error: "Failed to update brand name" };
        }
      },
    },
    {
      name: "update_primary_color",
      type: "trigger_tool",
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
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          hex: {
            type: "string",
            description:
              "Hex color code including the # prefix (e.g. #22c55e for green, #3b82f6 for blue). " +
              "Always convert color names to hex before calling.",
          },
        },
        required: ["hex"],
      },
      execute: async (data: { hex?: string }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const hex = data.hex?.trim();
        if (!hex || !/^#[0-9a-f]{3,8}$/i.test(hex)) {
          return {
            success: false,
            error: "A valid hex color code is required",
          };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              branding: {
                ...currentProduct.config?.branding,
                primaryColor: hex,
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return {
            success: true,
            message: `Primary color updated to ${hex}`,
          };
        } catch {
          return { success: false, error: "Failed to update primary color" };
        }
      },
    },
    {
      name: "update_ai_assistant_name",
      type: "trigger_tool",
      description:
        "Update the AI assistant's display name shown in the chat widget. " +
        "Use when user wants to rename the chatbot, change the assistant name, " +
        "or personalize the AI identity. This saves immediately.",
      examples: [
        "call my AI assistant Luna",
        "rename the chatbot to Helper",
        "change assistant name to Support Bot",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The new name for the AI assistant",
          },
        },
        required: ["name"],
      },
      execute: async (data: { name?: string }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const name = data.name;
        if (!name?.trim()) {
          return { success: false, error: "Name is required" };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              ai: {
                ...currentProduct.config?.ai,
                assistantName: name.trim(),
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return {
            success: true,
            message: `AI assistant name updated to "${name}"`,
          };
        } catch {
          return {
            success: false,
            error: "Failed to update AI assistant name",
          };
        }
      },
    },
    {
      name: "update_ai_welcome_message",
      type: "trigger_tool",
      description:
        "Update the welcome message shown when users open the AI chat. " +
        "Use when user wants to change the greeting, update the intro message, " +
        "or customize how the AI introduces itself. This saves immediately.",
      examples: [
        "set welcome message to Hi! How can I help?",
        "change the greeting to Welcome to our help center",
        "update the intro message",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The new welcome message to display",
          },
        },
        required: ["message"],
      },
      execute: async (data: { message?: string }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const message = data.message;
        if (!message?.trim()) {
          return { success: false, error: "Message is required" };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              ai: {
                ...currentProduct.config?.ai,
                welcomeMessage: message.trim(),
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return { success: true, message: "Welcome message updated" };
        } catch {
          return { success: false, error: "Failed to update welcome message" };
        }
      },
    },
    {
      name: "set_suggested_questions",
      type: "trigger_tool",
      description:
        "Set the suggested questions that appear in the AI chat widget. " +
        "Use when user wants to configure starter questions, conversation starters, " +
        "or example queries. This saves immediately.",
      examples: [
        "set starter questions to How do I get started, What are the pricing plans",
        "add suggested questions",
        "update the example questions",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "List of suggested questions (3-5 recommended)",
          },
        },
        required: ["questions"],
      },
      execute: async (data: { questions?: string[] }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const questions = data.questions;
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
          return { success: false, error: "At least one question is required" };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              ai: {
                ...currentProduct.config?.ai,
                suggestedQuestions: questions
                  .map((q) => q.trim())
                  .filter(Boolean),
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return {
            success: true,
            message: `Set ${questions.length} suggested questions`,
          };
        } catch {
          return {
            success: false,
            error: "Failed to update suggested questions",
          };
        }
      },
    },
    {
      name: "update_fallback_message",
      type: "trigger_tool",
      description:
        "Update the fallback message shown when the AI cannot answer a question. " +
        "Use when user wants to customize what happens when the AI doesn't know, " +
        "or change the escalation message. This saves immediately.",
      examples: [
        "set fallback message to Let me connect you with support",
        "change what the AI says when it doesn't know",
        "update the I don't know response",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The new fallback message to display",
          },
        },
        required: ["message"],
      },
      execute: async (data: { message?: string }) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const message = data.message;
        if (!message?.trim()) {
          return { success: false, error: "Message is required" };
        }
        try {
          await adminPatch(`/configs/${currentProduct.id}/`, {
            config: {
              ...currentProduct.config,
              ai: {
                ...currentProduct.config?.ai,
                fallbackMessage: message.trim(),
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: configKeys.all });
          return { success: true, message: "Fallback message updated" };
        } catch {
          return { success: false, error: "Failed to update fallback message" };
        }
      },
    },
  ]);

  // =========================================================================
  // Knowledge Source tools
  // =========================================================================
  usePillarTool([
    {
      name: "add_new_source",
      type: "navigate",
      description:
        "Navigate to add a new knowledge source. Opens a wizard to connect " +
        "external documentation, help centers, knowledge bases, websites, or cloud storage buckets. " +
        "Use when user wants to import content, connect a source, add an integration, " +
        "or sync from an external platform. " +
        "Extract the source type and URL if mentioned in the user's message.",
      examples: [
        "can you help me setup my help center import",
        "how do I import my help center",
        "connect a knowledge source",
        "add a new source",
        "import documentation",
        "setup help center import",
        "connect my help center",
        "add knowledge base",
        "import content from website",
        "connect external documentation",
      ],
      autoRun: true,
      autoComplete: true,
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "Source type ID if user mentions a specific type. Values: " +
              "'website' for crawling any website (help centers, docs sites, marketing sites), " +
              "'bucket' for cloud storage buckets (S3/GCS)",
          },
          url: {
            type: "string",
            description: "URL of the source to connect (for website crawl)",
          },
          name: {
            type: "string",
            description: "Display name for the source if mentioned",
          },
        },
      },
      execute: (data: {
        type?: string;
        url?: string;
        name?: string;
        highlight_selector?: string;
      }) => {
        const params = new URLSearchParams();
        if (data.type) params.set("type", data.type);
        if (data.url) params.set("url", data.url);
        if (data.name) params.set("name", data.name);

        const queryString = params.toString();
        const path = queryString
          ? `/knowledge/new?${queryString}`
          : "/knowledge/new";
        nav(path, data.highlight_selector);
      },
    },
    {
      name: "crawl_website",
      type: "navigate",
      description:
        "Crawl a website by URL to import content. Works for help centers, " +
        "documentation sites, marketing sites, and any public website. " +
        "Use when user wants to import content from a website, help center, docs site, " +
        "or marketing site. Examples: Zendesk Guide sites, Intercom help centers, " +
        "GitBook sites, custom documentation sites, company marketing pages.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/knowledge/new?type=website");
      },
    },
    {
      name: "connect_cloud_storage",
      type: "navigate",
      description:
        "Connect a cloud storage bucket (AWS S3 or Google Cloud Storage) to sync documents. " +
        "Use when user wants to connect S3, GCS, cloud storage, or sync files from buckets.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/knowledge/new?type=bucket");
      },
    },
    {
      name: "resync_source",
      type: "trigger_tool",
      description:
        "Trigger a re-sync for a knowledge source to refresh content. " +
        "Use when user wants to update content, refresh docs, re-crawl a website, " +
        "or sync the latest changes from a source. " +
        "Call list_sources first if source_id is unknown.",
      examples: [
        "resync my documentation",
        "refresh the knowledge base",
        "re-crawl the website",
        "update the docs source",
        "sync the help center again",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          source_id: {
            type: "string",
            description: "ID of the source to resync (from list_sources)",
          },
        },
        required: ["source_id"],
      },
      execute: async (data: { source_id?: string }) => {
        const sourceId = data.source_id;
        if (!sourceId) {
          return { success: false, error: "source_id is required" };
        }
        try {
          await knowledgeSourcesAPI.triggerSync(sourceId);
          return { success: true, message: "Sync started successfully" };
        } catch {
          return { success: false, error: "Failed to start sync" };
        }
      },
    },
    {
      name: "delete_source",
      type: "trigger_tool",
      description:
        "Delete a knowledge source and remove all its content from the knowledge base. " +
        "This is a destructive tool that cannot be undone. " +
        "Use when user wants to remove a source, disconnect an integration, " +
        "or delete imported content.",
      examples: [
        "delete the old documentation source",
        "remove the website crawl",
        "disconnect the help center",
        "delete knowledge source",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          source_id: {
            type: "string",
            description: "ID of the source to delete (from list_sources)",
          },
        },
        required: ["source_id"],
      },
      execute: async (data: { source_id?: string }) => {
        const sourceId = data.source_id;
        if (!sourceId) {
          return { success: false, error: "source_id is required" };
        }
        try {
          await knowledgeSourcesAPI.delete(sourceId);
          return { success: true, message: "Source deleted successfully" };
        } catch {
          return { success: false, error: "Failed to delete source" };
        }
      },
    },
  ]);

  // =========================================================================
  // Team Management tools
  // =========================================================================
  usePillarTool([
    {
      name: "invite_members",
      type: "trigger_tool",
      description:
        "Open the invite members dialog to send team invitations. " +
        "Use when user wants to invite someone, add a team member, or send an invite. " +
        "If the user mentions specific emails or a role, pass them to pre-fill the dialog.",
      examples: [
        "invite someone",
        "add a team member",
        "invite user@example.com",
        "send an invite",
        "invite my team",
      ],
      autoRun: true,
      autoComplete: true,
      inputSchema: {
        type: "object",
        properties: {
          emails: {
            type: "array",
            items: { type: "string" },
            description: "Email addresses to pre-fill in the invite dialog",
          },
          role: {
            type: "string",
            enum: ["admin", "member"],
            description: "Role for the invitees (defaults to member)",
          },
        },
      },
      execute: (data: { emails?: string[]; role?: "admin" | "member" }) => {
        openInviteMembersModal({
          emails: data.emails,
          role: data.role,
        });
        return { success: true, message: "Invite members dialog opened." };
      },
    },
    {
      name: "open_team_settings",
      type: "navigate",
      description:
        "Navigate to the Team settings page to view and manage team members, " +
        "invitations, and permissions. Use when user asks about team, members, " +
        "users, invites, or wants to manage who has access to the organization.",
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/team", data.highlight_selector);
      },
    },
    {
      name: "view_pending_invitations",
      type: "navigate",
      description:
        "View all pending team invitations that haven't been accepted yet. " +
        "Use when user asks about outstanding invites, who hasn't joined yet, " +
        "wants to check invitation status, or see pending team invites.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/team?filter=pending");
      },
    },
    {
      name: "resend_invitation",
      type: "navigate",
      description:
        "Resend a pending invitation email to a user who hasn't accepted yet. " +
        "Use when user asks to resend an invite, remind someone about their " +
        "invitation, send another invite email, or nudge a pending invitee.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/team?filter=pending");
      },
    },
    {
      name: "cancel_invitation",
      type: "navigate",
      description:
        "Cancel a pending invitation so the link no longer works. " +
        "Use when user wants to revoke access before someone accepts, " +
        "cancel an invite, remove a pending invitation, or rescind an invite.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/team?filter=pending");
      },
    },
    {
      name: "remove_team_member",
      type: "navigate",
      description:
        "Remove a user from the organization and revoke their access. " +
        "Use when user wants to remove someone from the team, revoke access, " +
        "delete a team member, or kick someone out. Warning: this is irreversible.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/team");
      },
    },
    {
      name: "promote_to_admin",
      type: "navigate",
      description:
        "Promote a team member to organization admin role, giving them ability " +
        "to invite/remove team members. This changes their TEAM ROLE, not " +
        "resource permissions. Use only when user explicitly says 'make admin' " +
        "or 'promote to admin' without mentioning a specific resource.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/team");
      },
    },
    {
      name: "demote_to_member",
      type: "navigate",
      description:
        "Change an organization admin back to regular member role. This changes " +
        "their TEAM ROLE, not resource permissions. Use only when user explicitly " +
        "says 'demote' or 'remove admin role' without mentioning a specific resource.",
      autoRun: false,
      autoComplete: false,
      execute: () => {
        nav("/team");
      },
    },
    {
      name: "update_user_permissions",
      type: "navigate",
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
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          userName: {
            type: "string",
            description: "Name or email of the user to update",
          },
          resource: {
            type: "string",
            description: "The resource area to update permissions for",
          },
          level: {
            type: "string",
            description: "The permission level to set",
          },
        },
        required: ["userName", "resource", "level"],
      },
      execute: (data: { userId?: string }) => {
        const userId = data.userId;
        nav(`/team?tab=permissions&highlight=${userId || ""}`);
      },
    },
  ]);

  // =========================================================================
  // Billing tools
  // =========================================================================
  usePillarTool([
    {
      name: "open_billing",
      type: "navigate",
      description:
        "Navigate to the Billing page to view subscription plan, usage stats, " +
        "invoices, and payment settings. Use when user asks about billing, " +
        "invoices, subscription, plan details, or payment information.",
      autoRun: true,
      autoComplete: true,
      execute: (data: { highlight_selector?: string }) => {
        nav("/billing", data.highlight_selector);
      },
    },
    {
      name: "set_usage_alert",
      type: "navigate",
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
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            description: "Dollar amount threshold for the alert",
          },
          channel: {
            type: "string",
            description: "Where to send notifications (email or slack)",
          },
        },
      },
      execute: () => {
        nav("/billing?section=alerts");
      },
    },
  ]);

  // =========================================================================
  // Domain security tools
  // =========================================================================
  usePillarTool([
    {
      name: "add_allowed_domain",
      type: "trigger_tool",
      description:
        "Add a domain to the allowed domains list for embed security. " +
        "Use when user wants to whitelist a domain, allow a new domain, " +
        "add localhost for testing, or configure CORS/embed domains. " +
        "This saves immediately.",
      examples: [
        "add localhost:3000 to allowed domains",
        "allow localhost for testing",
        "whitelist *.example.com",
        "add my domain to the embed allowlist",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description:
              "Domain to allow (e.g., localhost:3000, *.example.com, app.mysite.com)",
          },
        },
        required: ["domain"],
      },
      execute: async (data: { domain?: string }) => {
        return executeAddAllowedDomain(data, {
          currentProduct: currentProduct as Parameters<
            typeof executeAddAllowedDomain
          >[1]["currentProduct"],
          adminPatch,
          invalidateQueries: () =>
            queryClient.invalidateQueries({ queryKey: configKeys.all }),
          nav: (path: string) => nav(path),
        });
      },
    },
  ]);

  // =========================================================================
  // API Key tools
  // =========================================================================
  usePillarTool([
    {
      name: "generate_api_key",
      type: "trigger_tool" as const,
      description:
        "Generate a new API key (sync secret) for the current project. " +
        "The raw key is securely delivered via a Reveal button — it never appears in conversation history. " +
        "Use when user asks to create, generate, or add an API key. " +
        "Always provide a name — do NOT ask the user for one. If they specified a name, use it. " +
        "Otherwise, pick a sensible default like 'default', 'development', or 'api-key-1'.",
      examples: [
        "generate an API key",
        "create a new API key",
        "I need an API key",
        "add an API key called production",
        "generate a key for CI",
      ],
      autoRun: true,
      autoComplete: true,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Label for the key (e.g. production, staging, ci). " +
              "Lowercase alphanumeric and hyphens only. " +
              "Always provide a value — use the user's choice if given, otherwise default to 'default'.",
          },
        },
        required: ["name"],
      },
      outputSchema: {
        type: "object" as const,
        properties: {
          secret: { type: "string", sensitive: true },
          name: { type: "string" },
          id: { type: "string" },
        },
      },
      execute: async (data: { name?: string }) => {
        const name =
          data.name?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "default";
        const productId = currentProduct?.id;
        if (!productId) {
          return { error: "No product selected" };
        }
        const result = await adminFetch<{ id: string; name: string; secret: string; message?: string }>(
          `/configs/${productId}/secrets/`,
          { method: "POST", body: JSON.stringify({ name }) },
        );
        return result;
      },
    },
    {
      name: "manage_api_keys",
      type: "trigger_tool" as const,
      description:
        "Open the API key manager dialog. Lists all existing keys " +
        "with the ability to create new keys or revoke existing ones. " +
        "Use when user wants to view, list, manage, or delete API keys.",
      examples: [
        "show my API keys",
        "list API keys",
        "delete an API key",
        "manage API keys",
        "view my keys",
        "revoke an API key",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        openApiKeysModal();
        return { success: true, message: "API key manager opened." };
      },
    },
    {
      name: "list_api_keys",
      type: "query",
      description:
        "Get the list of API keys (sync secrets) for the current project. " +
        "Returns key names, creation dates, and last used dates. " +
        "Call this when you need to reference keys by name before other operations.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        const productId = currentProduct?.id;
        if (!productId) {
          return { error: "No product selected" };
        }
        try {
          const secrets = await adminFetch<
            Array<{
              id: string;
              name: string;
              created_at: string;
              last_used_at: string | null;
            }>
          >(`/configs/${productId}/secrets/`);
          return {
            keys: secrets.map((s) => ({
              id: s.id,
              name: s.name,
              createdAt: s.created_at,
              lastUsedAt: s.last_used_at,
            })),
            count: secrets.length,
            canCreateMore: secrets.length < 10,
          };
        } catch {
          return { keys: [], count: 0, error: "Failed to load API keys" };
        }
      },
    },
  ]);

  // =========================================================================
  // Analytics tools
  // =========================================================================
  usePillarTool([
    {
      name: "view_search_analytics",
      type: "navigate",
      description:
        "View search analytics including popular queries, failed searches, and " +
        "search trends. Use when user asks about search analytics, popular searches, " +
        "what people are searching for, or search performance.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/analytics/search");
      },
    },
    {
      name: "view_ai_analytics",
      type: "navigate",
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
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/analytics/ai");
      },
    },
    {
      name: "view_analytics_last_7_days",
      type: "navigate",
      description:
        "View analytics dashboard for the last 7 days. " +
        "Use when user asks about this week's performance, recent metrics, " +
        "or short-term analytics.",
      examples: [
        "show me last 7 days analytics",
        "this week's performance",
        "recent metrics",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/analytics?range=7d");
      },
    },
    {
      name: "view_analytics_last_30_days",
      type: "navigate",
      description:
        "View analytics dashboard for the last 30 days. " +
        "Use when user asks about this month's performance or monthly metrics.",
      examples: [
        "show me last 30 days analytics",
        "this month's performance",
        "monthly metrics",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/analytics?range=30d");
      },
    },
    {
      name: "view_analytics_last_90_days",
      type: "navigate",
      description:
        "View analytics dashboard for the last 90 days (quarterly). " +
        "Use when user asks about quarterly performance or longer-term trends.",
      examples: [
        "show me quarterly analytics",
        "last 90 days metrics",
        "3 month performance",
      ],
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/analytics?range=90d");
      },
    },
    {
      name: "search_conversations",
      type: "navigate",
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
      autoRun: true,
      autoComplete: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find matching conversations",
          },
        },
        required: ["query"],
      },
      execute: (data: { query?: string }) => {
        const query = data.query;
        if (!query) {
          nav("/analytics/conversations");
          return;
        }
        nav(`/analytics/conversations?search=${encodeURIComponent(query)}`);
      },
    },
    {
      name: "export_conversations_csv",
      type: "trigger_tool",
      description:
        "Export conversations to a CSV file for the specified date range. " +
        "Use when user wants to download conversation data, export chat logs, " +
        "or get analytics data for external analysis.",
      examples: [
        "export conversations to CSV",
        "download conversation data",
        "export chat logs",
      ],
      autoRun: false,
      autoComplete: false,
      inputSchema: {
        type: "object",
        properties: {
          range: {
            type: "string",
            description: "Date range: '7d', '30d', or '90d'",
          },
        },
      },
      execute: async (data: { range?: string }) => {
        const range = data.range || "30d";
        const dateRange = getDateRangeFromPreset(range as "7d" | "30d" | "90d");

        try {
          const response = await analyticsAPI.listConversations({
            started_at_gte: dateRange.start,
            started_at_lte: dateRange.end,
            page_size: 1000,
          });

          const headers = [
            "ID",
            "Started At",
            "Status",
            "Message Count",
            "First Message",
          ];
          const rows = response.results.map((c) => [
            c.id,
            c.started_at,
            c.status,
            c.message_count,
            `"${(c.first_user_message || "").replace(/"/g, '""').substring(0, 100)}"`,
          ]);

          const csv = [
            headers.join(","),
            ...rows.map((row) => row.join(",")),
          ].join("\n");

          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `conversations-${dateRange.start}-to-${dateRange.end}.csv`;
          a.click();
          URL.revokeObjectURL(url);

          return {
            success: true,
            message: `Exported ${response.results.length} conversations`,
          };
        } catch {
          return { success: false, error: "Failed to export conversations" };
        }
      },
    },
  ]);

  // =========================================================================
  // Query tools - Return data for agent reasoning
  // =========================================================================
  usePillarTool([
    {
      name: "list_sources",
      type: "query",
      description:
        "Get the list of configured knowledge sources. " +
        "Returns source IDs, names, types, and sync status. " +
        "Call this before suggesting source-specific tools to know what exists. " +
        "Example: Before suggesting 'crawl website', check if a website source exists.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        try {
          const response = await knowledgeSourcesAPI.list();
          const sources = response.results || [];
          return {
            sources: sources.map((s) => ({
              id: s.id,
              name: s.name,
              type: s.source_type,
              url:
                s.crawl_config?.start_url || s.connection_config?.bucket_name,
              status: s.status,
              lastSynced: s.last_synced_at,
            })),
            count: sources.length,
            hasWebsite: sources.some((s) => s.source_type === "website_crawl"),
            hasCloudStorage: sources.some(
              (s) => s.source_type === "cloud_storage"
            ),
          };
        } catch (error) {
          console.error("[Pillar] Error listing sources:", error);
          return { sources: [], count: 0, error: "Failed to load sources" };
        }
      },
    },
    {
      name: "get_source_sync_status",
      type: "query",
      description:
        "Get detailed sync status for a knowledge source. " +
        "Returns last sync time, document count, errors, and progress. " +
        "Call this when user asks about sync status or content freshness.",
      autoRun: true,
      autoComplete: true,
      inputSchema: {
        type: "object",
        properties: {
          source_id: {
            type: "string",
            description: "The source ID to check (from list_sources)",
          },
        },
        required: ["source_id"],
      },
      execute: async (data: { source_id?: string }) => {
        const sourceId = data.source_id;
        if (!sourceId) {
          return { error: "source_id is required" };
        }
        try {
          const source = await knowledgeSourcesAPI.get(sourceId);
          return {
            id: source.id,
            name: source.name,
            status: source.status,
            lastSyncedAt: source.last_synced_at,
            documentCount: source.document_count,
            errorMessage: source.error_message,
          };
        } catch (error) {
          console.error("[Pillar] Error getting source status:", error);
          return { error: "Failed to get source status" };
        }
      },
    },
    {
      name: "list_team_members",
      type: "query",
      description:
        "Get the list of team members and pending invitations. " +
        "Returns member emails, roles, and status. " +
        "Call this before suggesting invite or role-change tools.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        const organizationId = getCurrentOrganizationId();
        if (!organizationId) {
          return { error: "No organization context" };
        }
        try {
          const [members, invitations] = await Promise.all([
            organizationAPI.getMembers(organizationId),
            organizationAPI.getInvitations(organizationId),
          ]);
          return {
            members: members.map((m) => ({
              email: m.user.email,
              name: m.user.full_name || m.user.email,
              role: m.role,
            })),
            pendingInvitations: invitations
              .filter((i) => i.status === "pending")
              .map((i) => ({
                email: i.email,
                role: i.role,
                invitedAt: i.created_at,
              })),
            memberCount: members.length,
            pendingCount: invitations.filter((i) => i.status === "pending")
              .length,
          };
        } catch (error) {
          console.error("[Pillar] Error listing team members:", error);
          return { error: "Failed to load team members" };
        }
      },
    },
    {
      name: "get_help_center_status",
      type: "query",
      description:
        "Get the overall help center setup status. " +
        "Returns what's configured and what's missing. " +
        "Call this when helping with initial setup or onboarding.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        try {
          const sourcesResponse = await knowledgeSourcesAPI.list();
          const sources = sourcesResponse.results || [];
          return {
            hasContent: sources.length > 0,
            sourceCount: sources.length,
            hasWebsite: sources.some((s) => s.source_type === "website_crawl"),
            hasCloudStorage: sources.some(
              (s) => s.source_type === "cloud_storage"
            ),
            setupComplete: sources.length > 0,
          };
        } catch (error) {
          console.error("[Pillar] Error getting help center status:", error);
          return { error: "Failed to get status" };
        }
      },
    },
    {
      name: "list_snippets",
      type: "query",
      description:
        "Get the list of custom instruction snippets. " +
        "Returns snippet titles and excerpts. " +
        "Call this when user asks about custom instructions or AI behavior customization.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        try {
          const response = await snippetsAPI.list();
          const snippets = response.results || [];
          return {
            snippets: snippets.map((s) => ({
              id: s.id,
              title: s.title,
              excerpt: s.excerpt || s.raw_content || "",
            })),
            count: snippets.length,
          };
        } catch (error) {
          console.error("[Pillar] Error listing snippets:", error);
          return { snippets: [], count: 0, error: "Failed to load snippets" };
        }
      },
    },
    {
      name: "get_conversation_stats",
      type: "query",
      webMCP: true,
      description:
        "Get AI conversation statistics for the past 30 days. " +
        "Returns total conversations, resolution rate, feedback, and top questions. " +
        "Call this when user asks about usage, performance, or analytics.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        try {
          const range = getDateRangeFromPreset("30d");
          const stats = await analyticsAPI.getAIUsage(range);
          return {
            totalConversations: stats.stats.totalConversations,
            changePercent: stats.stats.changePercent,
            resolutionRate: stats.stats.resolutionRate,
            avgMessagesPerChat: stats.stats.avgMessagesPerChat,
            feedback: stats.stats.feedback,
            topQuestions: stats.stats.topQuestions?.slice(0, 5) || [],
            dateRange: stats.dateRange,
          };
        } catch (error) {
          console.error("[Pillar] Error getting conversation stats:", error);
          return { error: "Failed to load conversation statistics" };
        }
      },
    },
    {
      name: "get_product_settings",
      type: "query",
      webMCP: true,
      description:
        "Get the current product configuration. " +
        "Returns brand name, features enabled, and AI settings. " +
        "Call this when user asks about settings or configuration.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        if (!currentProduct) {
          return { error: "No product context" };
        }
        return {
          name: currentProduct.name,
          subdomain: currentProduct.subdomain,
          branding: currentProduct.config?.branding,
          features: currentProduct.config?.features,
          ai: currentProduct.config?.ai,
        };
      },
    },
    {
      name: "list_tools",
      type: "query",
      description:
        "Get the list of defined tools for this product. " +
        "Returns tool names, descriptions, and types. " +
        "Call this when user asks what you can do or what tools are available.",
      autoRun: true,
      autoComplete: true,
      execute: async () => {
        try {
          const response = await actionsAPI.list({
            status: "published",
          });
          const tools = response.results || [];
          return {
            tools: tools.map((a) => ({
              name: a.name,
              description: a.description,
              type: a.action_type,
            })),
            count: tools.length,
          };
        } catch (error) {
          console.error("[Pillar] Error listing tools:", error);
          return { tools: [], count: 0, error: "Failed to load tools" };
        }
      },
    },
  ]);
}

/** @deprecated Use usePillarTools instead */
export const usePillartools = usePillarTools;
