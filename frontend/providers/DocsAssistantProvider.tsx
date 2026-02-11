"use client";

import { PillarProvider } from "@pillar-ai/react";

export function DocsAssistantProvider({ children }: { children: React.ReactNode }) {
  const productKey = "pillar-docs";
  const apiBaseUrl = process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

  return (
    <PillarProvider
      productKey={productKey}
      config={{
        apiBaseUrl,
        panel: { position: "right", width: 400 },
        theme: { mode: "auto" },
      }}
    >
      {children}
    </PillarProvider>
  );
}
