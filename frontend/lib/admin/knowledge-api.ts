/**
 * Knowledge API module for Help Center admin dashboard.
 *
 * Provides CRUD operations for Knowledge Sources, Items, and Snippets.
 */
import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';
import type {
  KnowledgeSource,
  KnowledgeSourceListResponse,
  KnowledgeItem,
  KnowledgeItemListResponse,
  CreateKnowledgeSourceRequest,
  UpdateKnowledgeSourceRequest,
  CreateSnippetRequest,
  UpdateSnippetRequest,
  UpdateKnowledgeItemRequest,
  KnowledgeSyncResponse,
  KnowledgeSourceType,
  KnowledgeSourceStatus,
  KnowledgeItemStatus,
  KnowledgeItemType,
} from '@/types/knowledge';

// ============================================================================
// List Params
// ============================================================================

export interface KnowledgeSourceListParams {
  source_type?: KnowledgeSourceType;
  status?: KnowledgeSourceStatus;
  search?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface KnowledgeItemListParams {
  source?: string;
  item_type?: KnowledgeItemType;
  status?: KnowledgeItemStatus;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface SnippetListParams {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface DocumentDownloadUrlResponse {
  download_url: string;
  filename: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
}

// ============================================================================
// Knowledge Sources API
// ============================================================================

export const knowledgeSourcesAPI = {
  /**
   * List all knowledge sources.
   */
  list: async (params?: KnowledgeSourceListParams): Promise<KnowledgeSourceListResponse> => {
    return adminFetch<KnowledgeSourceListResponse>('/knowledge/sources/', { params });
  },

  /**
   * Get a single knowledge source by ID.
   */
  get: async (id: string): Promise<KnowledgeSource> => {
    return adminFetch<KnowledgeSource>(`/knowledge/sources/${id}/`);
  },

  /**
   * Create a new knowledge source.
   */
  create: async (data: CreateKnowledgeSourceRequest): Promise<KnowledgeSource> => {
    return adminPost<KnowledgeSource>('/knowledge/sources/', data);
  },

  /**
   * Update an existing knowledge source.
   */
  update: async (id: string, data: UpdateKnowledgeSourceRequest): Promise<KnowledgeSource> => {
    return adminPatch<KnowledgeSource>(`/knowledge/sources/${id}/`, data);
  },

  /**
   * Delete a knowledge source.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete(`/knowledge/sources/${id}/`);
  },

  /**
   * Trigger a sync for a knowledge source.
   * Pass { restart: true } to stop the current sync (if any) and start a fresh one.
   */
  triggerSync: async (
    id: string,
    options?: { restart?: boolean }
  ): Promise<KnowledgeSyncResponse> => {
    return adminPost<KnowledgeSyncResponse>(`/knowledge/sources/${id}/sync/`, {
      restart: options?.restart ?? false,
    });
  },
};

// ============================================================================
// Knowledge Items API
// ============================================================================

export const knowledgeItemsAPI = {
  /**
   * List knowledge items with optional filters.
   */
  list: async (params?: KnowledgeItemListParams): Promise<KnowledgeItemListResponse> => {
    return adminFetch<KnowledgeItemListResponse>('/knowledge/items/', { params });
  },

  /**
   * Get a single knowledge item by ID.
   */
  get: async (id: string): Promise<KnowledgeItem> => {
    return adminFetch<KnowledgeItem>(`/knowledge/items/${id}/`);
  },

  /**
   * Update a knowledge item (toggle is_active, etc.)
   */
  update: async (id: string, data: UpdateKnowledgeItemRequest): Promise<KnowledgeItem> => {
    return adminPatch<KnowledgeItem>(`/knowledge/items/${id}/`, data);
  },

  /**
   * Delete a knowledge item.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete(`/knowledge/items/${id}/`);
  },

  /**
   * Trigger reprocessing of a knowledge item.
   */
  reprocess: async (id: string): Promise<{ status: string }> => {
    return adminPost<{ status: string }>(`/knowledge/items/${id}/reprocess/`, {});
  },

  /**
   * Get a signed download URL for a document item.
   */
  getDownloadUrl: async (id: string): Promise<DocumentDownloadUrlResponse> => {
    return adminFetch<DocumentDownloadUrlResponse>(`/knowledge/items/${id}/download-url/`);
  },
};

// ============================================================================
// Snippets API (convenience wrapper for snippet-type items)
// ============================================================================

export const snippetsAPI = {
  /**
   * List all snippets.
   */
  list: async (params?: SnippetListParams): Promise<KnowledgeItemListResponse> => {
    return adminFetch<KnowledgeItemListResponse>('/knowledge/snippets/', { params });
  },

  /**
   * Get a single snippet.
   */
  get: async (id: string): Promise<KnowledgeItem> => {
    return adminFetch<KnowledgeItem>(`/knowledge/snippets/${id}/`);
  },

  /**
   * Create a new snippet.
   */
  create: async (data: CreateSnippetRequest): Promise<KnowledgeItem> => {
    return adminPost<KnowledgeItem>('/knowledge/snippets/', data);
  },

  /**
   * Update a snippet.
   */
  update: async (id: string, data: UpdateSnippetRequest): Promise<KnowledgeItem> => {
    return adminPatch<KnowledgeItem>(`/knowledge/snippets/${id}/`, data);
  },

  /**
   * Delete a snippet.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete(`/knowledge/snippets/${id}/`);
  },
};
