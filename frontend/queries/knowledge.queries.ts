/**
 * TanStack Query configurations for Knowledge API.
 *
 * Includes queries and mutations for knowledge sources, items, and snippets.
 */
import { queryOptions } from '@tanstack/react-query';
import {
  knowledgeSourcesAPI,
  knowledgeItemsAPI,
  snippetsAPI,
  type KnowledgeSourceListParams,
  type KnowledgeItemListParams,
  type SnippetListParams,
} from '@/lib/admin/knowledge-api';
import type {
  CreateKnowledgeSourceRequest,
  UpdateKnowledgeSourceRequest,
  CreateSnippetRequest,
  UpdateSnippetRequest,
  UpdateKnowledgeItemRequest,
} from '@/types/knowledge';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const knowledgeKeys = {
  all: ['knowledge'] as const,

  // Sources
  sources: () => [...knowledgeKeys.all, 'sources'] as const,
  sourceList: (params?: KnowledgeSourceListParams) =>
    [...knowledgeKeys.sources(), 'list', params] as const,
  sourceDetail: (id: string) =>
    [...knowledgeKeys.sources(), 'detail', id] as const,

  // Items
  items: () => [...knowledgeKeys.all, 'items'] as const,
  itemList: (params?: KnowledgeItemListParams) =>
    [...knowledgeKeys.items(), 'list', params] as const,
  itemDetail: (id: string) => [...knowledgeKeys.items(), 'detail', id] as const,

  // Snippets (subset of items)
  snippets: () => [...knowledgeKeys.all, 'snippets'] as const,
  snippetList: (params?: SnippetListParams) =>
    [...knowledgeKeys.snippets(), 'list', params] as const,
  snippetDetail: (id: string) =>
    [...knowledgeKeys.snippets(), 'detail', id] as const,
};

// =============================================================================
// Query Options - Sources
// =============================================================================

/**
 * List all knowledge sources
 */
export const knowledgeSourceListQuery = (params?: KnowledgeSourceListParams) =>
  queryOptions({
    queryKey: knowledgeKeys.sourceList(params),
    queryFn: () => knowledgeSourcesAPI.list(params),
  });

/**
 * Get a single knowledge source by ID
 */
export const knowledgeSourceDetailQuery = (id: string) =>
  queryOptions({
    queryKey: knowledgeKeys.sourceDetail(id),
    queryFn: () => knowledgeSourcesAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Query Options - Items
// =============================================================================

/**
 * List knowledge items with optional filters
 */
export const knowledgeItemListQuery = (params?: KnowledgeItemListParams) =>
  queryOptions({
    queryKey: knowledgeKeys.itemList(params),
    queryFn: () => knowledgeItemsAPI.list(params),
  });

/**
 * Get a single knowledge item by ID
 */
export const knowledgeItemDetailQuery = (id: string) =>
  queryOptions({
    queryKey: knowledgeKeys.itemDetail(id),
    queryFn: () => knowledgeItemsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Query Options - Snippets
// =============================================================================

/**
 * List all snippets
 */
export const snippetListQuery = (params?: SnippetListParams) =>
  queryOptions({
    queryKey: knowledgeKeys.snippetList(params),
    queryFn: () => snippetsAPI.list(params),
  });

/**
 * Get a single snippet by ID
 */
export const snippetDetailQuery = (id: string) =>
  queryOptions({
    queryKey: knowledgeKeys.snippetDetail(id),
    queryFn: () => snippetsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Mutations - Sources
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
export const triggerKnowledgeSyncMutation = () => ({
  mutationFn: (args: { id: string; restart?: boolean }) =>
    knowledgeSourcesAPI.triggerSync(args.id, { restart: args.restart }),
});

// =============================================================================
// Mutations - Items
// =============================================================================

/**
 * Update a knowledge item
 */
export const updateKnowledgeItemMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateKnowledgeItemRequest }) =>
    knowledgeItemsAPI.update(id, data),
});

/**
 * Delete a knowledge item
 */
export const deleteKnowledgeItemMutation = () => ({
  mutationFn: (id: string) => knowledgeItemsAPI.delete(id),
});

/**
 * Reprocess a knowledge item
 */
export const reprocessKnowledgeItemMutation = () => ({
  mutationFn: (id: string) => knowledgeItemsAPI.reprocess(id),
});

/**
 * Get download URL for a document item
 */
export const getDocumentDownloadUrlMutation = () => ({
  mutationFn: (id: string) => knowledgeItemsAPI.getDownloadUrl(id),
});

// =============================================================================
// Mutations - Snippets
// =============================================================================

/**
 * Create a new snippet
 */
export const createSnippetMutation = () => ({
  mutationFn: (data: CreateSnippetRequest) => snippetsAPI.create(data),
});

/**
 * Update a snippet
 */
export const updateSnippetMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateSnippetRequest }) =>
    snippetsAPI.update(id, data),
});

/**
 * Delete a snippet
 */
export const deleteSnippetMutation = () => ({
  mutationFn: (id: string) => snippetsAPI.delete(id),
});
