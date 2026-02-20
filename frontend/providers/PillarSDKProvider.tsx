"use client";

/**
 * PillarSDKProvider
 *
 * Wraps the admin panel with the Pillar SDK for dogfooding.
 * - Provides the embedded widget for contextual help
 * - Syncs route context as the user navigates
 * - Registers task handlers for AI-suggested tools via usePillarTools hook
 * - Syncs theme with next-themes
 */

import {
  PillarProvider,
  usePillar,
  usePillarContext,
  type SidebarTabConfig,
  type ThemeMode,
} from "@pillar-ai/react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ApiKeysModal } from "@/components/ApiKeysModal";
import { InviteMembersModal } from "@/components/InviteMembersModal";
import { ThemeSelectorModal } from "@/components/ThemeSelectorModal";
import { usePillarTools } from "@/hooks/usePillarTools";
import { applyPendingHighlight } from "@/lib/highlight";
import { useAuth } from "./AuthProvider";

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
      <ApiKeysModal />
      <InviteMembersModal />
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
 * Uses usePillarTools() hook for co-located tool definitions.
 */
function PillarRouteSync() {
  const { pillar } = usePillar();
  const pathname = usePathname();
  const { user } = useAuth();

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

  // Register all Pillar tools via the co-located usePillarTools hook
  usePillarTools();

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
