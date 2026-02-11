"use client";

/**
 * PillarSDKProvider
 *
 * Wraps the admin panel with the Pillar SDK for dogfooding.
 * - Provides the embedded widget for contextual help
 * - Syncs route context as the user navigates
 * - Registers task handlers for AI-suggested actions (type-safe!)
 * - Syncs theme with next-themes
 */

import {
  show as showIntercom,
  showNewMessage as showIntercomWithMessage,
} from "@intercom/messenger-js-sdk";
import {
  PillarProvider,
  usePillar,
  usePillarContext,
  type SidebarTabConfig,
  type ThemeMode,
} from "@pillar-ai/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  InviteMembersCard,
  SetUsageAlertCard,
  UpdatePermissionsCard,
} from "@/components/PillarCards";
import {
  openThemeSelectorModal,
  ThemeSelectorModal,
} from "@/components/ThemeSelectorModal";
import { actionsAPI } from "@/lib/admin/actions-api";
import {
  analyticsAPI,
  getDateRangeFromPreset,
} from "@/lib/admin/analytics-api";
import { adminPatch, getCurrentOrganizationId } from "@/lib/admin/api-client";
import { snippetsAPI } from "@/lib/admin/knowledge-api";
import { organizationAPI } from "@/lib/admin/organization-api";
import { knowledgeSourcesAPI } from "@/lib/admin/sources-api";
import { applyPendingHighlight, navigateAndHighlight } from "@/lib/highlight";
import type { Actions } from "@/lib/pillar/actions";
import { configKeys } from "@/queries/config.queries";
import { useAuth } from "./AuthProvider";
import { useProduct } from "./ProductProvider";

interface PillarSDKProviderProps {
  children: React.ReactNode;
}

/**
 * Main provider component that wraps the app with Pillar SDK
 */
export function PillarSDKProvider({ children }: PillarSDKProviderProps) {
  // Use environment variables with fallbacks for local development
  // The SDK calls /api/v1/help-center endpoints which are served by backend
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
  const productKey =
    process.env.NEXT_PUBLIC_PILLAR_PRODUCT_KEY || "pillar-help";

  // Sidebar tabs are configured client-side. Clicking non-assistant tabs emits
  // 'sidebar:click' events that can be handled to trigger custom actions (e.g., Intercom).
  const sidebarTabs: SidebarTabConfig[] = [
    { id: "assistant", label: "Assistant", enabled: true, order: 0 },
    {
      id: "support",
      label: "Support",
      enabled: true,
      order: 1,
      icon: "support",
    },
  ];

  return (
    <PillarProvider
      productKey={productKey}
      domScanning={true}
      config={{
        apiBaseUrl,
        sidebarTabs,
        panel: {
          position: "right",
          width: 400,
        },
        theme: {
          mode: "auto",
          fontFamily:
            '"Suisse Intl", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          colors: {
            primary: "#C2410C",
            primaryHover: "#9A3412",
            background: "#FFFFFF",
            backgroundSecondary: "#F9F7F5",
            text: "#171717",
            textMuted: "#6B7280",
            border: "#E5E7EB",
            borderLight: "#F3F4F6",
            outlineColor: "#EA580C",
          },
          darkColors: {
            primary: "#EA580C",
            primaryHover: "#FB923C",
            background: "#121212",
            backgroundSecondary: "#1A1A1A",
            text: "#C1C1C1",
            textMuted: "#888888",
            border: "#222222",
            borderLight: "#1A1A1A",
            outlineColor: "#EA580C",
          },
        },
      }}
      // Custom card renderers for inline_ui type actions
      cards={{
        invite_members: InviteMembersCard,
        set_usage_alert: SetUsageAlertCard,
        update_permissions: UpdatePermissionsCard,
      }}
    >
      {children}
    </PillarProvider>
  );
}

/**
 * Internal provider that handles all Pillar sync operations.
 * Must be inside PillarProvider to access SDK hooks.
 *
 * Responsibilities:
 * - Theme sync with next-themes
 * - User identity sync (identify/logout)
 * - Route context sync
 * - Task handler registration
 */
export function PillarSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PillarThemeSync />
      <PillarIdentitySync />
      <PillarRouteSync />
      <ThemeSelectorModal />
      {children}
    </>
  );
}

/**
 * Syncs the Pillar panel theme with next-themes.
 * Must be inside PillarProvider to access setTheme.
 */
function PillarThemeSync() {
  const { setTheme } = usePillarContext();
  const { resolvedTheme, theme } = useTheme();

  // Sync theme whenever next-themes changes
  useEffect(() => {
    // Map next-themes theme to SDK theme mode
    let themeMode: ThemeMode;
    if (theme === "system") {
      themeMode = "auto";
    } else if (resolvedTheme === "dark") {
      themeMode = "dark";
    } else {
      themeMode = "light";
    }

    setTheme({ mode: themeMode });
  }, [resolvedTheme, theme, setTheme]);

  return null;
}

/**
 * Internal component that syncs user identity with the Pillar SDK.
 * Handles identify() on login and logout() on sign out.
 */
function PillarIdentitySync() {
  const { pillar } = usePillar();
  const { user } = useAuth();

  useEffect(() => {
    if (!pillar) return;

    if (user) {
      pillar
        .identify(user.id, {
          name: user.name || user.email,
          email: user.email,
        })
        .catch((err: unknown) => {
          console.warn("[Pillar] Failed to identify user:", err);
        });
    } else {
      pillar.logout();
    }
  }, [pillar, user]);

  return null;
}

/**
 * Internal component that syncs route changes and registers task handlers.
 * Separated to keep the main provider clean and allow use of hooks.
 *
 * Uses typed usePillar<Actions>() for type-safe onTask handlers.
 */
function PillarRouteSync() {
  const { pillar, onTask } = usePillar<Actions>();
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme: setNextTheme } = useTheme();
  const { currentProduct } = useProduct();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Sync route context
  useEffect(() => {
    if (!pillar) return;

    pillar.setContext({
      currentPage: pathname,
      currentFeature: getFeatureName(pathname),
      userRole: user?.role,
    });
  }, [pathname, pillar, user]);

  // Apply pending highlight when pathname changes (after navigation)
  useEffect(() => {
    // Small delay to allow the page to render before highlighting
    applyPendingHighlight(500);
  }, [pathname]);

  // Register task handlers for AI-suggested actions
  // Using typed onTask from usePillar<Actions>() for type-safe handlers
  useEffect(() => {
    // Helper to navigate with optional highlight
    const nav = (path: string, highlight?: string) => {
      navigateAndHighlight(router, path, highlight);
    };
    if (!pillar) return;

    const unsubscribers: (() => void)[] = [];

    // =========================================================================
    // Sidebar Tab Click Handler - triggers custom actions for non-assistant tabs
    // Customers can use pillar.on('sidebar:click', ...) to trigger their own systems
    // Example: Intercom, Zendesk, custom feedback modal, etc.
    // =========================================================================
    unsubscribers.push(
      pillar.on("sidebar:click", ({ tabId }) => {
        if (tabId === "support") {
          // Close the assistant panel first so Intercom isn't competing for attention
          pillar.close();
          showIntercom();
        }
      })
    );

    // =========================================================================
    // Escalate Action Handler - opens Intercom with prefilled context
    // Triggered when AI routes to ESCALATE (user wants human support)
    // =========================================================================
    unsubscribers.push(
      pillar.onTask("escalate", () => {
        // Build context message from current page and conversation
        const currentPage = pathname || window.location.pathname;
        const pageContext = getFeatureName(currentPage);

        // Get conversation history from the SDK
        const chatContext = pillar.getChatContext();

        // Build prefilled message with conversation context
        let prefilledMessage = `Hi! I was using the AI assistant on the ${pageContext} page (${currentPage}) and need some help from a human.`;

        if (chatContext && chatContext.messages.length > 0) {
          // Include conversation summary (last few exchanges, truncated)
          const conversationSummary = chatContext.messages
            .slice(-6) // Last 3 exchanges (6 messages)
            .map((m) => {
              const prefix = m.role === "user" ? "Me" : "AI";
              return `${prefix}: ${m.content}`;
            })
            .join("\n");

          prefilledMessage += `\n\n--- Conversation with AI ---\n${conversationSummary}`;
        }

        showIntercomWithMessage(prefilledMessage);
      })
    );

    // =========================================================================
    // Generic Navigation Handler (supports highlight_selector from data)
    // Uses pillar.onTask for generic "navigate" task type (not in our actions)
    // =========================================================================
    unsubscribers.push(
      pillar.onTask("navigate", (data) => {
        const path = data.path;
        const highlight = data.highlight_selector as string | undefined;
        if (typeof path === "string") {
          nav(path, highlight);
        }
      })
    );

    // =========================================================================
    // Navigation Actions (open_* patterns)
    // Type-safe: data has { highlight_selector?: string }
    // =========================================================================
    unsubscribers.push(
      onTask("open_knowledge", (data) =>
        nav("/knowledge", data.highlight_selector)
      )
    );
    unsubscribers.push(
      onTask("open_actions", (data) => nav("/actions", data.highlight_selector))
    );
    unsubscribers.push(
      onTask("open_settings", (data) =>
        nav("/configure", data.highlight_selector)
      )
    );
    unsubscribers.push(
      onTask("open_analytics", (data) =>
        nav("/analytics", data.highlight_selector)
      )
    );
    unsubscribers.push(
      onTask("open_configure", (data) =>
        nav("/configure", data.highlight_selector)
      )
    );

    // =========================================================================
    // Settings Actions
    // =========================================================================
    // change_theme opens a modal for quick theme switching
    unsubscribers.push(onTask("change_theme", () => openThemeSelectorModal()));

    // =========================================================================
    // Settings Feature Toggles (trigger_action type)
    // These navigate to the appropriate configure section where the user can toggle
    // =========================================================================
    unsubscribers.push(
      onTask("enable_ai_assistant", () => nav("/configure#ai"))
    );
    unsubscribers.push(
      onTask("disable_ai_assistant", () => nav("/configure#ai"))
    );
    unsubscribers.push(onTask("update_logo", () => nav("/configure#branding")));
    unsubscribers.push(
      onTask("add_footer_link", () => nav("/configure#footer"))
    );
    unsubscribers.push(
      onTask("configure_suggested_questions", () => nav("/configure#ai"))
    );

    // Dark mode actions - context-aware
    // Type-safe: data has { action: "set_theme", theme: "dark" }
    unsubscribers.push(
      onTask("enable_dark_mode", () => {
        setNextTheme("dark");
      })
    );
    unsubscribers.push(
      onTask("disable_dark_mode", () => {
        setNextTheme("light");
      })
    );
    unsubscribers.push(
      onTask("toggle_dark_mode", () => {
        const currentTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        setNextTheme(currentTheme === "dark" ? "light" : "dark");
      })
    );

    // =========================================================================
    // Settings Autosave Actions
    // These actions directly update settings via API and save immediately
    // =========================================================================
    unsubscribers.push(
      onTask("update_brand_name", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const name = data.name as string;
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
      })
    );

    unsubscribers.push(
      onTask("update_primary_color", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const hex = (data.hex as string)?.trim();
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
      })
    );

    unsubscribers.push(
      onTask("update_ai_assistant_name", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const name = data.name as string;
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
      })
    );

    unsubscribers.push(
      onTask("update_ai_welcome_message", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const message = data.message as string;
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
      })
    );

    unsubscribers.push(
      onTask("set_suggested_questions", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const questions = data.questions as string[];
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
      })
    );

    unsubscribers.push(
      onTask("update_fallback_message", async (data) => {
        if (!currentProduct?.id) {
          return { success: false, error: "No product selected" };
        }
        const message = data.message as string;
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
      })
    );

    // =========================================================================
    // Knowledge Source Actions
    // Type-safe: data has { type?, url?, name?, highlight_selector? }
    // =========================================================================
    unsubscribers.push(
      onTask("add_new_source", (data) => {
        const params = new URLSearchParams();
        // Type-safe access - TypeScript knows these are string | undefined
        if (data.type) params.set("type", data.type);
        if (data.url) params.set("url", data.url);
        if (data.name) params.set("name", data.name);

        const queryString = params.toString();
        const path = queryString
          ? `/knowledge/new?${queryString}`
          : "/knowledge/new";
        nav(path, data.highlight_selector);
      })
    );

    unsubscribers.push(
      onTask("resync_source", async (data) => {
        const sourceId = data.source_id as string;
        if (!sourceId) {
          return { success: false, error: "source_id is required" };
        }
        try {
          await knowledgeSourcesAPI.triggerSync(sourceId);
          return { success: true, message: "Sync started successfully" };
        } catch {
          return { success: false, error: "Failed to start sync" };
        }
      })
    );

    unsubscribers.push(
      onTask("delete_source", async (data) => {
        const sourceId = data.source_id as string;
        if (!sourceId) {
          return { success: false, error: "source_id is required" };
        }
        try {
          await knowledgeSourcesAPI.delete(sourceId);
          return { success: true, message: "Source deleted successfully" };
        } catch {
          return { success: false, error: "Failed to delete source" };
        }
      })
    );

    // =========================================================================
    // Team Management Actions
    // =========================================================================
    unsubscribers.push(
      onTask("open_team_settings", (data) =>
        nav("/team", data.highlight_selector)
      )
    );

    // invite_team_member is an inline_ui action - the InviteMembersCard handles everything
    // No navigation handler needed - the card renders inline and sends invites directly

    // View pending invitations - navigates with filter
    unsubscribers.push(
      onTask("view_pending_invitations", () => nav("/team?filter=pending"))
    );

    // Invitation management actions - navigate to team page where user can take action
    unsubscribers.push(
      onTask("resend_invitation", () => nav("/team?filter=pending"))
    );
    unsubscribers.push(
      onTask("cancel_invitation", () => nav("/team?filter=pending"))
    );

    // Member management actions - navigate to team page where user can take action
    unsubscribers.push(onTask("remove_team_member", () => nav("/team")));
    unsubscribers.push(onTask("promote_to_admin", () => nav("/team")));
    unsubscribers.push(onTask("demote_to_member", () => nav("/team")));

    // Resource permissions - inline_ui pattern (card handles update, handler navigates)
    unsubscribers.push(
      onTask("update_user_permissions", (data) => {
        // Card already updated the permissions, just navigate to show result
        // userId is passed by the card in onConfirm
        const userId = (data as Record<string, unknown>).userId as string;
        nav(`/team?tab=permissions&highlight=${userId || ""}`);
      })
    );

    // =========================================================================
    // Billing Actions
    // =========================================================================
    unsubscribers.push(
      onTask("open_billing", (data) => nav("/billing", data.highlight_selector))
    );

    // set_usage_alert is an inline_ui action - the SetUsageAlertCard handles the update
    // This handler navigates to billing after the card confirms
    unsubscribers.push(
      onTask("set_usage_alert", () => {
        nav("/billing?section=alerts");
      })
    );

    // =========================================================================
    // Analytics Actions
    // Time range navigation and data export
    // =========================================================================

    // Time range navigation - these use navigate type with URL params
    unsubscribers.push(
      onTask("view_analytics_last_7_days", () => nav("/analytics?range=7d"))
    );
    unsubscribers.push(
      onTask("view_analytics_last_30_days", () => nav("/analytics?range=30d"))
    );
    unsubscribers.push(
      onTask("view_analytics_last_90_days", () => nav("/analytics?range=90d"))
    );

    // Conversation search - navigate with search pre-filled
    unsubscribers.push(
      onTask("search_conversations", (data) => {
        const query = data.query as string;
        if (!query) {
          nav("/analytics/conversations");
          return;
        }
        nav(`/analytics/conversations?search=${encodeURIComponent(query)}`);
      })
    );

    // Export conversations to CSV
    unsubscribers.push(
      onTask("export_conversations_csv", async (data) => {
        const range = (data.range as string) || "30d";
        const { getDateRangeFromPreset } =
          await import("@/lib/admin/analytics-api");
        const { analyticsAPI } = await import("@/lib/admin/analytics-api");
        const dateRange = getDateRangeFromPreset(range as "7d" | "30d" | "90d");

        try {
          // Fetch conversations
          const response = await analyticsAPI.listConversations({
            started_at_gte: dateRange.start,
            started_at_lte: dateRange.end,
            page_size: 1000,
          });

          // Generate CSV
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

          // Trigger download
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
      })
    );

    // =========================================================================
    // Query Actions - Return data for agent reasoning
    // These have `returns: true` so the SDK sends their return value to the agent
    // =========================================================================

    // List configured knowledge sources
    unsubscribers.push(
      onTask("list_sources", async () => {
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
      })
    );

    // Get sync status for a specific source
    unsubscribers.push(
      onTask("get_source_sync_status", async (data) => {
        const sourceId = data.source_id as string | undefined;
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
      })
    );

    // List team members and pending invitations
    unsubscribers.push(
      onTask("list_team_members", async () => {
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
      })
    );

    // Get help center setup status
    unsubscribers.push(
      onTask("get_help_center_status", async () => {
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
      })
    );

    // List custom instruction snippets
    unsubscribers.push(
      onTask("list_snippets", async () => {
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
      })
    );

    // Get AI conversation statistics
    unsubscribers.push(
      onTask("get_conversation_stats", async () => {
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
      })
    );

    // Get product settings
    unsubscribers.push(
      onTask("get_product_settings", async () => {
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
      })
    );

    // List available actions
    unsubscribers.push(
      onTask("list_actions", async () => {
        try {
          const response = await actionsAPI.list({
            status: "published",
          });
          const actions = response.results || [];
          return {
            actions: actions.map((a) => ({
              name: a.name,
              description: a.description,
              type: a.action_type,
            })),
            count: actions.length,
          };
        } catch (error) {
          console.error("[Pillar] Error listing actions:", error);
          return { actions: [], count: 0, error: "Failed to load actions" };
        }
      })
    );

    // Cleanup on unmount
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    pillar,
    onTask,
    router,
    setNextTheme,
    currentProduct,
    queryClient,
    pathname,
  ]);

  return null;
}

/**
 * Extract a human-readable feature name from the current path
 */
function getFeatureName(path: string): string {
  // Map paths to feature names
  const featureMap: Record<string, string> = {
    "/knowledge": "Knowledge",
    "/actions": "Actions",
    "/settings": "Settings",
    "/team": "Team",
    "/configure": "Configure",
    "/analytics": "Analytics",
    "/billing": "Billing",
  };

  // Check for exact matches first
  if (featureMap[path]) {
    return featureMap[path];
  }

  // Check for path prefixes
  for (const [prefix, name] of Object.entries(featureMap)) {
    if (path.startsWith(prefix)) {
      return name;
    }
  }

  // Default fallback
  return "Knowledge";
}
