/**
 * TanStack Query configurations for Knowledge Sources API.
 */
import {
  knowledgeSourcesAPI,
  type KnowledgeSourceListParams,
  type KnowledgeSourceSearchResponse,
  type CreateKnowledgeSourceRequest,
  type UpdateKnowledgeSourceRequest,
} from "@/lib/admin/sources-api";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const knowledgeSourceKeys = {
  all: ["knowledge-source"] as const,

  // Lists
  lists: () => [...knowledgeSourceKeys.all, "list"] as const,
  list: (params?: KnowledgeSourceListParams) =>
    [...knowledgeSourceKeys.lists(), params] as const,

  // Search
  search: (q: string) => [...knowledgeSourceKeys.all, "search", q] as const,

  // Details
  details: () => [...knowledgeSourceKeys.all, "detail"] as const,
  detail: (id: string) => [...knowledgeSourceKeys.details(), id] as const,

  // Sync History
  syncHistory: (id: string) =>
    [...knowledgeSourceKeys.detail(id), "sync-history"] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * List all knowledge sources
 */
export const knowledgeSourceListQuery = (params?: KnowledgeSourceListParams) =>
  queryOptions({
    queryKey: knowledgeSourceKeys.list(params),
    queryFn: () => knowledgeSourcesAPI.list(params),
  });

/**
 * Infinite query config for searching items across sources.
 * Returns flat paginated items; the sidebar groups them by source.
 */
export const knowledgeSourceSearchInfiniteOptions = (q: string, pageSize = 50) => ({
  queryKey: knowledgeSourceKeys.search(q),
  queryFn: ({ pageParam }: { pageParam: unknown }) =>
    knowledgeSourcesAPI.search({ q, page: pageParam as number, page_size: pageSize }),
  getNextPageParam: (lastPage: KnowledgeSourceSearchResponse, allPages: KnowledgeSourceSearchResponse[]) =>
    lastPage.next ? allPages.length + 1 : undefined,
  initialPageParam: 1 as unknown,
  enabled: q.length >= 2,
});

/**
 * Get a single knowledge source by ID
 */
export const knowledgeSourceDetailQuery = (id: string) =>
  queryOptions({
    queryKey: knowledgeSourceKeys.detail(id),
    queryFn: () => knowledgeSourcesAPI.get(id),
    enabled: !!id,
  });

/**
 * Get sync history for a source
 */
export const knowledgeSourceSyncHistoryQuery = (id: string) =>
  queryOptions({
    queryKey: knowledgeSourceKeys.syncHistory(id),
    queryFn: () => knowledgeSourcesAPI.getSyncHistory(id),
    enabled: !!id,
  });

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new knowledge source
 */
export const createKnowledgeSourceMutation = () => ({
  mutationFn: (data: CreateKnowledgeSourceRequest) =>
    knowledgeSourcesAPI.create(data),
});

/**
 * Update an existing knowledge source
 */
export const updateKnowledgeSourceMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateKnowledgeSourceRequest }) =>
    knowledgeSourcesAPI.update(id, data),
});

/**
 * Delete a knowledge source
 */
export const deleteKnowledgeSourceMutation = () => ({
  mutationFn: (id: string) => knowledgeSourcesAPI.delete(id),
});

/**
 * Trigger a sync for a knowledge source.
 * Pass { restart: true } when source is syncing to stop and start a fresh sync.
 */
export const triggerKnowledgeSourceSyncMutation = () => ({
  mutationFn: (args: { id: string; restart?: boolean }) =>
    knowledgeSourcesAPI.triggerSync(args.id, { restart: args.restart }),
});
