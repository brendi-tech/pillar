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
  domainLookups: () => [...agentScoreKeys.all, "domain-lookup"] as const,
  domainLookup: (domain: string) => [...agentScoreKeys.domainLookups(), domain] as const,
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

/**
 * Look up the latest completed report for a domain.
 * Returns the full report or null if none exists.
 */
export const agentScoreDomainLookupQuery = (
  domain: string,
  enabled: boolean = true,
) =>
  queryOptions({
    queryKey: agentScoreKeys.domainLookup(domain),
    queryFn: () => agentScoreAPI.lookupByDomain(domain),
    enabled: enabled && !!domain,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
