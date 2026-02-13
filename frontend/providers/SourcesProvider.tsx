"use client";

import { useWebSocketEvent } from "@/hooks/use-websocket-event";
import { getCurrentOrganizationId } from "@/lib/admin/api-client";
import { knowledgeSourceKeys, knowledgeSourceListQuery } from "@/queries/sources.queries";
import type { KnowledgeSourceConfig, KnowledgeSourceType } from "@/types/sources";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

// ============================================================================
// Knowledge Sources Context
// ============================================================================

interface SourcesByType {
  website_crawl: KnowledgeSourceConfig[];
  cloud_storage: KnowledgeSourceConfig[];
  document_upload: KnowledgeSourceConfig[];
  snippets: KnowledgeSourceConfig[];
}

interface SourceCounts {
  website_crawl: number;
  cloud_storage: number;
  document_upload: number;
  snippets: number;
  total: number;
}

interface SourcesContextValue {
  /** All sources as a flat list */
  sources: KnowledgeSourceConfig[];
  /** Sources grouped by type */
  sourcesByType: SourcesByType;
  /** Counts by type */
  counts: SourceCounts;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Find a specific source by ID (reads from the same cache as the sidebar) */
  getSourceById: (id: string) => KnowledgeSourceConfig | undefined;
  /** Refresh sources data */
  refresh: () => Promise<void>;
}

const SourcesContext = createContext<SourcesContextValue | undefined>(
  undefined
);

/**
 * Hook to access knowledge sources context.
 */
export function useSources(): SourcesContextValue {
  const context = useContext(SourcesContext);
  if (!context) {
    throw new Error("useSources must be used within a SourcesProvider");
  }
  return context;
}

// ============================================================================
// Sources Provider
// ============================================================================

interface SourcesProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages knowledge sources state across the admin dashboard.
 * Fetches sources on mount and provides grouped/counted data.
 */
export function SourcesProvider({ children }: SourcesProviderProps) {
  const queryClient = useQueryClient();

  // Get current organization ID - skip fetching if no org is selected
  const currentOrgId = getCurrentOrganizationId();

  const {
    data: sourcesResponse,
    isPending: isLoading,
    error: queryError,
  } = useQuery({
    ...knowledgeSourceListQuery(),
    enabled: !!currentOrgId,
  });

  // Get sources from response
  const sources = useMemo(() => {
    if (!sourcesResponse?.results) return [];
    return sourcesResponse.results;
  }, [sourcesResponse]);

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load sources"
    : null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
  }, [queryClient]);

  // Refresh sources when sync completes or fails (via WebSocket)
  useWebSocketEvent(
    'websocket:source.sync_completed',
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
    }, [queryClient])
  );

  useWebSocketEvent(
    'websocket:source.sync_failed',
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: knowledgeSourceKeys.lists() });
    }, [queryClient])
  );

  const getSourceById = useCallback(
    (id: string) => sources.find((s) => s.id === id),
    [sources]
  );

  // Group sources by type
  const sourcesByType = useMemo((): SourcesByType => {
    const grouped: SourcesByType = {
      website_crawl: [],
      cloud_storage: [],
      document_upload: [],
      snippets: [],
    };

    sources.forEach((source) => {
      const type = source.source_type as KnowledgeSourceType;
      if (type in grouped) {
        (grouped[type as keyof SourcesByType] as KnowledgeSourceConfig[]).push(source);
      }
    });

    // Sort each group alphabetically
    (Object.values(grouped) as KnowledgeSourceConfig[][]).forEach((group) => {
      group.sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [sources]);

  // Calculate counts
  const counts = useMemo(
    (): SourceCounts => ({
      website_crawl: sourcesByType.website_crawl.length,
      cloud_storage: sourcesByType.cloud_storage.length,
      document_upload: sourcesByType.document_upload.length,
      snippets: sourcesByType.snippets.length,
      total: sources.length,
    }),
    [sourcesByType, sources.length]
  );

  const contextValue = useMemo(
    () => ({
      sources,
      sourcesByType,
      counts,
      isLoading,
      error,
      getSourceById,
      refresh,
    }),
    [sources, sourcesByType, counts, isLoading, error, getSourceById, refresh]
  );

  return (
    <SourcesContext.Provider value={contextValue}>
      {children}
    </SourcesContext.Provider>
  );
}
