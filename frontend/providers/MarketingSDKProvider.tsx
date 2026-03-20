"use client";

/**
 * MarketingSDKProvider
 *
 * Lightweight SDK provider for the marketing homepage.
 * - Edge trigger and mobile trigger hidden (no visible copilot UI)
 * - Panel disabled (no chat panel)
 * - Registers WebMCP tools for browser agent navigation
 * - Destroys SDK on unmount to prevent leaking to other pages
 */

import { Pillar } from "@pillar-ai/sdk";
import { PillarProvider } from "@pillar-ai/react";
import { useEffect } from "react";
import { useMarketingWebMCP } from "@/components/MarketingPage/useMarketingWebMCP";

interface MarketingSDKProviderProps {
  children: React.ReactNode;
}

export function MarketingSDKProvider({ children }: MarketingSDKProviderProps) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
  const agentSlug =
    process.env.NEXT_PUBLIC_PILLAR_AGENT_SLUG || "pillar-help";

  // Destroy SDK on unmount to prevent UI leaking to other pages
  useEffect(() => {
    return () => {
      Pillar.destroy();
    };
  }, []);

  return (
    <PillarProvider
      agentSlug={agentSlug}
      config={{
        apiBaseUrl,
        panel: {
          enabled: false,
        },
        edgeTrigger: {
          enabled: false,
        },
        mobileTrigger: {
          enabled: false,
        },
        theme: {
          mode: "light",
        },
      }}
    >
      <MarketingWebMCPRegistrar />
      {children}
    </PillarProvider>
  );
}

/**
 * Inner component that registers WebMCP tools.
 * Must be inside PillarProvider to have access to SDK context.
 */
function MarketingWebMCPRegistrar() {
  useMarketingWebMCP();
  return null;
}
