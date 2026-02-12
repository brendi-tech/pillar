/**
 * TanStack Query configurations for Agent Score public API.
 * Includes polling for scan progress and scan mutation.
 */

import { agentScoreAPI } from "@/lib/public/agent-score-api";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const agentScoreKeys = {
  all: ["agent-score"] as const,
  reports: () => [...agentScoreKeys.all, "report"] as const,
  report: (id: string) => [...agentScoreKeys.reports(), id] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * Poll a report by ID. Refetches every 3s until status is complete or failed.
 */
export const agentScoreReportQuery = (
  reportId: string,
  enabled: boolean,
  initialLoad: boolean = false,
) =>
  queryOptions({
    queryKey: agentScoreKeys.report(reportId),
    queryFn: () => agentScoreAPI.getReport(reportId),
    enabled: enabled && !!reportId,
    refetchInterval: initialLoad
      ? false
      : (query) => {
          const status = query.state.data?.status;
          if (status === "complete" || status === "failed") return false;
          return 3000;
        },
  });

// =============================================================================
// Mutations
// =============================================================================

export const scanUrlMutation = () => ({
  mutationFn: ({
    url,
    email,
    testSignup = true,
    forceRescan = false,
  }: {
    url: string;
    email?: string;
    testSignup?: boolean;
    forceRescan?: boolean;
  }) => agentScoreAPI.scan(url, email, testSignup, forceRescan),
});
