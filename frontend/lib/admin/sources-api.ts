/**
 * Knowledge Sources API module for admin dashboard.
 * Simplified to match the backend KnowledgeSource model.
 */
import { adminFetch, adminPost, adminPatch, adminDelete, apiClient, getStoredAccessToken, getCurrentOrganizationId, getCurrentProductId } from './api-client';
import type {
  KnowledgeSourceConfig,
  KnowledgeSourceType,
  KnowledgeSourceStatus,
  KnowledgeSourceListResponse,
  CrawlConfig,
  ConnectionConfig,
  SyncHistoryItem,
  TriggerSyncResponse,
  CreateKnowledgeSourceRequest,
  UpdateKnowledgeSourceRequest,
  OAuthStartResponse,
  TestConnectionResponse,
  DocumentUploadResponse,
  PendingUpload,
} from '@/types/sources';

// ============================================================================
// API List Params
// ============================================================================

export interface KnowledgeSourceListParams {
  source_type?: KnowledgeSourceType;
  status?: KnowledgeSourceStatus;
  search?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
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
  get: async (id: string): Promise<KnowledgeSourceConfig> => {
    return adminFetch<KnowledgeSourceConfig>(`/knowledge/sources/${id}/`);
  },

  /**
   * Create a new knowledge source.
   */
  create: async (data: CreateKnowledgeSourceRequest): Promise<KnowledgeSourceConfig> => {
    return adminPost<KnowledgeSourceConfig>('/knowledge/sources/', data);
  },

  /**
   * Update an existing knowledge source.
   */
  update: async (id: string, data: UpdateKnowledgeSourceRequest): Promise<KnowledgeSourceConfig> => {
    return adminPatch<KnowledgeSourceConfig>(`/knowledge/sources/${id}/`, data);
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
  ): Promise<TriggerSyncResponse> => {
    return adminPost<TriggerSyncResponse>(`/knowledge/sources/${id}/sync/`, {
      restart: options?.restart ?? false,
    });
  },

  /**
   * Get sync history for a knowledge source.
   */
  getSyncHistory: async (id: string): Promise<SyncHistoryItem[]> => {
    return adminFetch<SyncHistoryItem[]>(`/knowledge/sources/${id}/sync-history/`);
  },

  // ==========================================================================
  // Integration OAuth Methods
  // ==========================================================================

  /**
   * Start OAuth flow for an integration.
   * Returns the source ID and OAuth URL to redirect to.
   */
  startOAuth: async (platform: string): Promise<OAuthStartResponse> => {
    return adminPost<OAuthStartResponse>('/knowledge/oauth/unified/start/', { platform });
  },

  // ==========================================================================
  // Cloud Storage Methods
  // ==========================================================================

  /**
   * Test cloud storage connection before creating source.
   */
  testConnection: async (config: ConnectionConfig): Promise<TestConnectionResponse> => {
    return adminPost<TestConnectionResponse>('/knowledge/sources/test-connection/', config);
  },

  // ==========================================================================
  // Document Upload Methods
  // ==========================================================================

  /**
   * Upload a document to an existing document_upload source.
   */
  uploadDocument: async (sourceId: string, file: File): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Build query params for org/product context (same as adminFetch/adminPost)
    const params = new URLSearchParams();
    const orgId = getCurrentOrganizationId();
    const productId = getCurrentProductId();
    if (orgId) params.append('organization', orgId);
    if (productId) params.append('product', productId);
    const queryString = params.toString();

    const token = getStoredAccessToken();
    const response = await apiClient.post<DocumentUploadResponse>(
      `/api/admin/knowledge/sources/${sourceId}/upload/${queryString ? `?${queryString}` : ''}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    return response.data;
  },

  /**
   * Upload multiple documents to a document_upload source.
   */
  uploadDocuments: async (sourceId: string, files: File[]): Promise<DocumentUploadResponse[]> => {
    const results = await Promise.all(
      files.map(file => knowledgeSourcesAPI.uploadDocument(sourceId, file))
    );
    return results;
  },

  // ==========================================================================
  // Pending Upload Methods (staging before source creation)
  // ==========================================================================

  /**
   * Upload a file to staging storage (before source is created).
   * Returns a pending upload that can be attached to a source later.
   */
  uploadPending: async (file: File): Promise<PendingUpload> => {
    const formData = new FormData();
    formData.append('file', file);

    // Build query params for org/product context (same as adminFetch/adminPost)
    const params = new URLSearchParams();
    const orgId = getCurrentOrganizationId();
    const productId = getCurrentProductId();
    if (orgId) params.append('organization', orgId);
    if (productId) params.append('product', productId);
    const queryString = params.toString();

    const token = getStoredAccessToken();
    const response = await apiClient.post<PendingUpload>(
      `/api/admin/knowledge/pending-uploads/${queryString ? `?${queryString}` : ''}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    return response.data;
  },

  /**
   * Delete a pending upload (if user removes file before creating source).
   */
  deletePending: async (uploadId: string): Promise<void> => {
    return adminDelete(`/knowledge/pending-uploads/${uploadId}/`);
  },

  /**
   * List pending uploads for the current user's organization.
   */
  listPending: async (): Promise<PendingUpload[]> => {
    const response = await adminFetch<{ results: PendingUpload[] }>('/knowledge/pending-uploads/');
    return response.results;
  },
};

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get all sources.
 */
export async function getSources(params?: KnowledgeSourceListParams): Promise<KnowledgeSourceConfig[]> {
  const response = await knowledgeSourcesAPI.list(params);
  return response.results;
}

/**
 * Get a single source by ID.
 */
export async function getSource(id: string): Promise<KnowledgeSourceConfig> {
  return knowledgeSourcesAPI.get(id);
}

/**
 * Create a new source.
 */
export async function createSource(data: CreateKnowledgeSourceRequest): Promise<KnowledgeSourceConfig> {
  return knowledgeSourcesAPI.create(data);
}

/**
 * Update an existing source.
 */
export async function updateSource(id: string, data: UpdateKnowledgeSourceRequest): Promise<KnowledgeSourceConfig> {
  return knowledgeSourcesAPI.update(id, data);
}

/**
 * Delete a source.
 */
export async function deleteSource(id: string): Promise<void> {
  return knowledgeSourcesAPI.delete(id);
}

/**
 * Trigger a sync for a source.
 */
export async function triggerSync(id: string): Promise<TriggerSyncResponse> {
  return knowledgeSourcesAPI.triggerSync(id);
}

/**
 * Get sync history for a source.
 */
export async function getSyncHistory(id: string): Promise<SyncHistoryItem[]> {
  return knowledgeSourcesAPI.getSyncHistory(id);
}

/**
 * Start OAuth flow for integration.
 */
export async function startOAuth(platform: string): Promise<OAuthStartResponse> {
  return knowledgeSourcesAPI.startOAuth(platform);
}

/**
 * Test cloud storage connection.
 */
export async function testConnection(config: ConnectionConfig): Promise<TestConnectionResponse> {
  return knowledgeSourcesAPI.testConnection(config);
}

/**
 * Upload a document to a source.
 */
export async function uploadDocument(sourceId: string, file: File): Promise<DocumentUploadResponse> {
  return knowledgeSourcesAPI.uploadDocument(sourceId, file);
}

/**
 * Upload multiple documents to a source.
 */
export async function uploadDocuments(sourceId: string, files: File[]): Promise<DocumentUploadResponse[]> {
  return knowledgeSourcesAPI.uploadDocuments(sourceId, files);
}

/**
 * Upload a file to staging storage (before source is created).
 */
export async function uploadPending(file: File): Promise<PendingUpload> {
  return knowledgeSourcesAPI.uploadPending(file);
}

/**
 * Delete a pending upload.
 */
export async function deletePending(uploadId: string): Promise<void> {
  return knowledgeSourcesAPI.deletePending(uploadId);
}

/**
 * List pending uploads.
 */
export async function listPending(): Promise<PendingUpload[]> {
  return knowledgeSourcesAPI.listPending();
}

// ============================================================================
// Snippets API
// ============================================================================

export interface CreateSnippetRequest {
  title: string;
  content: string;
  excerpt?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SnippetResponse {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  is_active: boolean;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new snippet (custom AI instruction).
 * Snippets are automatically associated with a "Custom Snippets" source.
 */
export async function createSnippet(data: CreateSnippetRequest): Promise<SnippetResponse> {
  return adminPost<SnippetResponse>('/knowledge/snippets/', data);
}

// Re-export types for convenience
export type {
  KnowledgeSourceConfig,
  KnowledgeSourceType,
  KnowledgeSourceStatus,
  KnowledgeSourceListResponse,
  CrawlConfig,
  ConnectionConfig,
  SyncHistoryItem,
  TriggerSyncResponse,
  CreateKnowledgeSourceRequest,
  UpdateKnowledgeSourceRequest,
  OAuthStartResponse,
  TestConnectionResponse,
  DocumentUploadResponse,
  PendingUpload,
};
