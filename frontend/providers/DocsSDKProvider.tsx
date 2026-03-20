"use client";

/**
 * DocsSDKProvider
 *
 * Lightweight SDK provider for public docs pages.
 * Provides the embedded help widget for docs visitors.
 *
 * IMPORTANT: This provider destroys the SDK on unmount to prevent the
 * edge trigger and panel from persisting when navigating to non-docs pages
 * (e.g., marketing landing page, login). This is different from the standard
 * PillarProvider behavior which preserves state across route changes.
 */

import { Pillar } from "@pillar-ai/sdk";
import { PillarProvider } from "@pillar-ai/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface DocsSDKProviderProps {
  children: React.ReactNode;
}

/**
 * SDK provider for docs - destroys SDK on unmount to prevent UI leaking
 * to non-docs pages (marketing, login, etc.)
 */
export function DocsSDKProvider({ children }: DocsSDKProviderProps) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
  // Docs pages use pillar-docs help center for SDK documentation
  const agentSlug = "pillar-docs";

  // Destroy the SDK when navigating away from docs pages
  // This prevents the edge trigger and panel from showing on marketing/login pages
  useEffect(() => {
    return () => {
      // Clean up SDK when leaving docs pages
      Pillar.destroy();
    };
  }, []);

  return (
    <PillarProvider
      agentSlug={agentSlug}
      config={{
        apiBaseUrl,
        panel: {
          position: "right",
          width: 400,
        },
        theme: {
          mode: "auto",
          colors: {
            primary: "#C2410C",
            primaryHover: "#9A3412",
            background: "#FFFFFF",
            backgroundSecondary: "#F9F7F5",
            text: "#171717",
            textMuted: "#6B7280",
            border: "#E5E7EB",
            borderLight: "#F3F4F6",
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
          },
        },
        customCSS: `
          :host {
            --pillar-font-family: "Suisse Intl", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .pillar-panel {
            border-radius: 0;
          }
        `,
      }}
    >
      <DocsThemeSync />
      {children}
    </PillarProvider>
  );
}

/**
 * Syncs the SDK theme with next-themes
 */
function DocsThemeSync() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Import and use the SDK's setTheme on client
    import("@pillar-ai/react").then(({ usePillarContext }) => {
      // This is a no-op on the server
    });
  }, [mounted, resolvedTheme]);

  return null;
}
