"use client";

import { PillarProvider } from "@pillar-ai/react";

export function DocsAssistantProvider({ children }: { children: React.ReactNode }) {
  const productKey = "pillar-docs";
  const publicKey = process.env.NEXT_PUBLIC_PILLAR_PUBLIC_KEY || "pk_dev_pillar";
  const apiBaseUrl = process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

  return (
    <PillarProvider
      productKey={productKey}
      publicKey={publicKey}
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
