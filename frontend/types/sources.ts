// ============================================================================
// Knowledge Sources Types (Simplified)
// ============================================================================
// Matches the backend KnowledgeSource model exactly

// --- Source Types (matches backend KnowledgeSource.SourceType) ---

export type KnowledgeSourceType = 
  | 'website_crawl'    // Crawl docs site, marketing pages, or knowledge base
  | 'cloud_storage'    // S3/GCS bucket sync
  | 'document_upload'  // Direct file uploads
  | 'snippets'         // Custom text snippets
  // Legacy types (kept for backwards compatibility)
  | 'help_center' 
  | 'marketing_site';

// --- Source Status (matches backend KnowledgeSource.Status) ---

export type KnowledgeSourceStatus = 'active' | 'syncing' | 'error' | 'paused';

// --- Crawl Configuration ---

export interface CrawlConfig {
  start_url?: string;
  max_pages?: number;
  include_paths?: string[];
  exclude_paths?: string[];
  /** Total pages discovered during mapping (set when sync starts) */
  pages_discovered?: number;
}

// --- Connection Configuration (for cloud_storage) ---

export interface ConnectionConfig {
  // Cloud Storage (S3)
  provider?: 's3' | 'gcs';
  bucket?: string;
  bucket_name?: string;  // Alias for bucket (used in some contexts)
  prefix?: string;
  region?: string;
  access_key?: string;
  secret_key?: string;
  
  // Cloud Storage (GCS)
  credentials_json?: string;
}

// --- Main Source Config Interface (matches backend serializer) ---

export interface KnowledgeSourceConfig {
  id: string;
  name: string;
  source_type: KnowledgeSourceType;
  url: string;
  crawl_config: CrawlConfig;
  connection_config: ConnectionConfig; // For cloud_storage
  status: KnowledgeSourceStatus;
  last_synced_at: string | null;
  item_count: number;        // Total pages crawled
  pages_indexed: number;     // Pages with embeddings (ready for AI)
  document_count?: number;   // Alias for item_count (used in some contexts)
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// --- Sync History ---

export interface SyncHistoryItem {
  id: string;
  sync_type: 'full' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  items_synced: number;
  items_created: number;
  items_updated: number;
  items_failed: number;
  error_message: string;
  created_at: string;
}

// --- Source Type Options (for wizard) ---

export interface KnowledgeSourceTypeOption {
  id: KnowledgeSourceType;
  name: string;
  description: string;
  icon: string;
  requiresUrl: boolean;
  requiresCredentials?: boolean;
  requiresUpload?: boolean;
}

export const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceTypeOption[] = [
  {
    id: 'website_crawl',
    name: 'Website Content (Crawl)',
    description: 'Crawl your docs site, marketing pages, or knowledge base.',
    icon: 'Globe',
    requiresUrl: true,
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
  {
    id: 'snippets',
    name: 'Custom Snippet',
    description: 'Add custom text snippets with specific instructions or context.',
    icon: 'FileText',
    requiresUrl: false,
  },
];

// --- Source Type Labels and Icons ---

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  website_crawl: 'Website Content',
  cloud_storage: 'Cloud Storage',
  document_upload: 'Document Upload',
  snippets: 'Custom Snippet',
  // Legacy
  help_center: 'Documentation Site',
  marketing_site: 'Marketing Site',
};

export const KNOWLEDGE_SOURCE_TYPE_ICONS: Record<KnowledgeSourceType, string> = {
  website_crawl: 'Globe',
  cloud_storage: 'Cloud',
  document_upload: 'Upload',
  snippets: 'FileText',
  // Legacy
  help_center: 'BookOpen',
  marketing_site: 'Globe',
};

// --- Status Labels and Colors ---

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

// --- Wizard State ---

export interface AddKnowledgeSourceState {
  step: 1 | 2;  // Step 1: Select type, Step 2: Type-specific form
  selectedType: KnowledgeSourceTypeOption | null;
  name: string;
  url: string;
  crawl_config: CrawlConfig;
  connection_config: ConnectionConfig;
  // For snippets
  snippet_content: string;
}

// --- API Request/Response Types ---

export interface CreateKnowledgeSourceRequest {
  source_type: KnowledgeSourceType;
  name: string;
  url?: string;
  crawl_config?: CrawlConfig;
  connection_config?: ConnectionConfig;
  /** List of pending upload IDs to attach (for document_upload sources) */
  pending_upload_ids?: string[];
}

// --- Connection Test Response ---

export interface TestConnectionResponse {
  valid: boolean;
  error?: string;
  objects_found?: number;
  supported_files?: number;
}

// --- Document Upload Response ---

export interface DocumentUploadResponse {
  id: string;
  source: string;
  title: string;
  status: string;
}

// --- Pending Upload (staging before source creation) ---

export interface PendingUpload {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  status: 'uploading' | 'staged' | 'expired' | 'error';
  error?: string;
  created_at: string;
  expires_at: string;
}

// --- OAuth Response ---

export interface OAuthStartResponse {
  source_id: string;
  oauth_url: string;
}

export interface UpdateKnowledgeSourceRequest {
  name?: string;
  url?: string;
  crawl_config?: CrawlConfig;
}

// --- List Response ---

export interface KnowledgeSourceListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KnowledgeSourceConfig[];
}

// --- Sync Response ---

export interface TriggerSyncResponse {
  status: string;
  source_id: string;
}
