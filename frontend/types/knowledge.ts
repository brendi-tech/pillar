// ============================================================================
// Knowledge App Types
// ============================================================================

// --- Source Types ---

export type KnowledgeSourceType = 
  | 'help_center' 
  | 'marketing_site' 
  | 'snippets'
  | 'cloud_storage'    // S3/GCS bucket sync
  | 'document_upload'; // Direct file uploads

export type KnowledgeSourceStatus = 'active' | 'syncing' | 'error' | 'paused';

export interface KnowledgeCrawlConfig {
  max_pages?: number;
  include_paths?: string[];
  exclude_paths?: string[];
}

// --- Connection Config (for cloud_storage type) ---

export interface ConnectionConfig {
  // Cloud Storage (S3)
  provider?: 's3' | 'gcs';
  bucket?: string;
  prefix?: string;
  region?: string;
  access_key?: string;
  secret_key?: string;
  
  // Cloud Storage (GCS)
  credentials_json?: string;
}

export interface KnowledgeSource {
  id: string;
  organization: string;
  help_center_config: string;

  source_type: KnowledgeSourceType;
  name: string;
  url: string | null; // null for snippets, integration, cloud_storage, document_upload
  crawl_config: KnowledgeCrawlConfig;
  connection_config: ConnectionConfig; // For integration and cloud_storage

  status: KnowledgeSourceStatus;
  status_display: string;
  last_synced_at: string | null;
  item_count: number;
  error_message: string | null;

  created_at: string;
  updated_at: string;
}

// --- Item Types ---

export type KnowledgeItemType = 'page' | 'snippet';

export type KnowledgeItemStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface KnowledgeItemMetadata {
  priority?: number; // For snippets - higher priority = more weight in RAG
  tags?: string[];
  [key: string]: unknown;
}

export interface KnowledgeItem {
  id: string;
  source: string; // FK to KnowledgeSource
  source_name: string;

  item_type: KnowledgeItemType;
  url: string | null;
  external_id: string;

  title: string;
  raw_content: string;
  optimized_content: string | null;
  has_optimized_content: boolean;
  excerpt: string | null;

  status: KnowledgeItemStatus;
  status_display: string;
  content_hash: string;
  processing_error: string;
  is_active: boolean;
  metadata: KnowledgeItemMetadata;

  chunk_count: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface KnowledgeSourceListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KnowledgeSource[];
}

export interface KnowledgeItemListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KnowledgeItem[];
}

export interface KnowledgeSyncResponse {
  workflow_run_id: string;
  source_id: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateKnowledgeSourceRequest {
  source_type: KnowledgeSourceType;
  name: string;
  url?: string;
  crawl_config?: KnowledgeCrawlConfig;
  connection_config?: ConnectionConfig;
  /** List of pending upload IDs to attach (for document_upload sources) */
  pending_upload_ids?: string[];
}

export interface UpdateKnowledgeSourceRequest {
  name?: string;
  url?: string;
  crawl_config?: KnowledgeCrawlConfig;
  status?: KnowledgeSourceStatus;
}

export interface CreateSnippetRequest {
  title: string;
  content: string;
  metadata?: KnowledgeItemMetadata;
}

export interface UpdateSnippetRequest {
  title?: string;
  content?: string;
  is_active?: boolean;
  metadata?: KnowledgeItemMetadata;
}

export interface UpdateKnowledgeItemRequest {
  is_active?: boolean;
  metadata?: KnowledgeItemMetadata;
}

// ============================================================================
// Helper Constants
// ============================================================================

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  help_center: 'Documentation Site',
  marketing_site: 'Marketing Site',
  snippets: 'Snippets',
  cloud_storage: 'Cloud Storage',
  document_upload: 'Document Upload',
};

export const KNOWLEDGE_SOURCE_TYPE_ICONS: Record<KnowledgeSourceType, string> = {
  help_center: 'HelpCircle',
  marketing_site: 'Globe',
  snippets: 'FileText',
  cloud_storage: 'Cloud',
  document_upload: 'Upload',
};

export const KNOWLEDGE_SOURCE_TYPE_DESCRIPTIONS: Record<KnowledgeSourceType, string> = {
  help_center: 'Crawl your documentation site or knowledge base',
  marketing_site: 'Crawl your company marketing pages',
  snippets: 'Add custom text snippets for the AI to reference',
  cloud_storage: 'Sync documents from S3 or GCS buckets',
  document_upload: 'Upload PDF, Word, or text files directly',
};

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeSourceStatus, string> = {
  active: 'Active',
  syncing: 'Syncing',
  error: 'Error',
  paused: 'Paused',
};

export const KNOWLEDGE_STATUS_COLORS: Record<KnowledgeSourceStatus, string> = {
  active: 'green',
  syncing: 'blue',
  error: 'red',
  paused: 'yellow',
};

export const KNOWLEDGE_ITEM_STATUS_LABELS: Record<KnowledgeItemStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  indexed: 'Indexed',
  failed: 'Failed',
};

export const KNOWLEDGE_ITEM_STATUS_COLORS: Record<KnowledgeItemStatus, string> = {
  pending: 'yellow',
  processing: 'blue',
  indexed: 'green',
  failed: 'red',
};

export const KNOWLEDGE_ITEM_TYPE_LABELS: Record<KnowledgeItemType, string> = {
  page: 'Page',
  snippet: 'Snippet',
};

// ============================================================================
// Source Type Options (for wizard)
// ============================================================================

export interface KnowledgeSourceTypeOption {
  id: KnowledgeSourceType;
  name: string;
  description: string;
  icon: string;
  requiresUrl: boolean;
  requiresCredentials?: boolean;
  requiresUpload?: boolean;
}

export const KNOWLEDGE_SOURCE_TYPE_OPTIONS: KnowledgeSourceTypeOption[] = [
  {
    id: 'help_center',
    name: 'Documentation Site',
    description: 'Crawl your docs site or knowledge base to give the AI context about your product.',
    icon: 'HelpCircle',
    requiresUrl: true,
  },
  {
    id: 'marketing_site',
    name: 'Marketing Site',
    description: 'Crawl your company marketing pages to help the AI understand your product positioning.',
    icon: 'Globe',
    requiresUrl: true,
  },
  {
    id: 'snippets',
    name: 'Custom Snippets',
    description: 'Add custom text snippets with specific instructions or context for the AI.',
    icon: 'FileText',
    requiresUrl: false,
  },
  {
    id: 'cloud_storage',
    name: 'Cloud Storage',
    description: 'Sync documents from your S3 or Google Cloud Storage bucket.',
    icon: 'Cloud',
    requiresUrl: false,
    requiresCredentials: true,
  },
  {
    id: 'document_upload',
    name: 'Document Upload',
    description: 'Upload PDF, Word, or text files directly.',
    icon: 'Upload',
    requiresUrl: false,
    requiresUpload: true,
  },
];
