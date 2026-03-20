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
import {
  analyticsAPI,
  getDateRangeFromPreset,
} from "@/lib/admin/analytics-api";
import { adminPatch } from "@/lib/admin/api-client";
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
    outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
      webMCP: true,
      type: "navigate",
      description:
        "Navigate to the Configure page to manage AI assistant settings, " +
        "security, and other options. Use when user asks about settings, " +
        "configuration, customization, preferences, configuring the assistant, " +
        "AI setup, or customizing how the AI responds.",
      examples: [
        "open settings",
        "go to settings",
        "settings page",
        "open configure",
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
      name: "open_tools",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      name: "create_new_tool",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      name: "enable_ai_assistant",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      name: "configure_suggested_questions",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
  // Knowledge Source tools
  // =========================================================================
  usePillarTool([
    {
      name: "add_new_source",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
      description:
        "Connect a cloud storage bucket (AWS S3 or Google Cloud Storage) to sync documents. " +
        "Use when user wants to connect S3, GCS, cloud storage, or sync files from buckets.",
      autoRun: true,
      autoComplete: true,
      execute: () => {
        nav("/knowledge/new?type=bucket");
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
      outputSchema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
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
      name: "manage_api_keys",
      type: "trigger_tool" as const,
      outputSchema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
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
  ]);

  // =========================================================================
  // Analytics tools
  // =========================================================================
  usePillarTool([
    {
      name: "view_search_analytics",
      type: "navigate",
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: {} },
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
      outputSchema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, error: { type: "string" } } },
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

}

/** @deprecated Use usePillarTools instead */
export const usePillartools = usePillarTools;
