"use client";

import { Suspense, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentScorePage } from "@/components/AgentScore";

function AgentScoreProviders({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default function AgentScoreRoute() {
  return (
    <AgentScoreProviders>
      <Suspense>
        <AgentScorePage />
      </Suspense>
    </AgentScoreProviders>
  );
}
