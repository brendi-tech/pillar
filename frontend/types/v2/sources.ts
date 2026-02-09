/**
 * V2 Sources Types
 *
 * Types for the new sources app models:
 * - DataSource (formerly HelpCenterSource)
 * - SourceSync
 * - SourceMapping
 * - SiteDiscovery
 * - GitHubRepository
 * - GitHubPullRequest
 * - CodeChunk
 * - BucketConnection
 * - BucketSyncLog
 */

// =============================================================================
// DataSource Types (formerly HelpCenterSource)
// =============================================================================

export type SourceCategory =
  | 'support_channels'
  | 'knowledge_base'
  | 'marketing_site'
  | 'help_center'
  | 'code_repository';

export type SourceProvider =
  // Ticketing
  | 'zendesk'
  | 'freshdesk'
  | 'hubspot'
  | 'gorgias'
  | 'jira_service_desk'
  | 'servicenow'
  | 'salesforce'
  // Messaging
  | 'intercom'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'email'
  // KMS
  | 'notion'
  | 'confluence'
  | 'coda'
  | 'clickup'
  | 'guru'
  // Web crawl
  | 'custom'
  | 'gitbook'
  | 'docusaurus'
  | 'readme'
  | 'mintlify'
  | 'pylon'
  // Video
  | 'youtube'
  | 'loom'
  // Podcast
  | 'podcast_rss'
  // Documents
  | 's3'
  | 'gcs'
  | 'uploaded_content'
  // Tasks
  | 'asana'
  | 'jira'
  | 'clickup_tasks'
  | 'github_issues'
  | 'linear'
  | 'monday'
  | 'trello'
  | 'basecamp'
  | 'bitbucket'
  // Code
  | 'github';

export type SourceStatus = 'active' | 'syncing' | 'paused' | 'error';

export interface DataSource {
  id: string;
  organization: string;
  product: string;
  name: string;
  category: SourceCategory;
  provider: SourceProvider | null;
  is_internal: boolean;
  connection: SourceConnection;
  sync: SourceSyncConfig;
  stats: SourceStats;
  status: SourceStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceConnection {
  url?: string;
  api_key?: string;
  subdomain?: string;
  workspace_id?: string;
  token?: string;
  encrypted_token?: string;
  [key: string]: unknown;
}

export interface SourceSyncConfig {
  auto_sync: boolean;
  frequency_hours: number | null;
  last_synced_at: string | null;
  next_sync_at: string | null;
  auto_categorize: boolean;
  ai_optimize: boolean;
}

export interface SourceStats {
  total_items: number;
  synced_items: number;
  failed_items: number;
  pending_items: number;
  last_change_detected: string | null;
}

export interface CreateDataSourcePayload {
  product: string;
  name: string;
  category: SourceCategory;
  provider?: SourceProvider;
  is_internal?: boolean;
  connection?: Partial<SourceConnection>;
  auto_sync?: boolean;
  frequency_hours?: number | null;
  auto_categorize?: boolean;
  ai_optimize?: boolean;
}

export interface UpdateDataSourcePayload {
  name?: string;
  is_internal?: boolean;
  connection?: Partial<SourceConnection>;
  auto_sync?: boolean;
  frequency_hours?: number | null;
  auto_categorize?: boolean;
  ai_optimize?: boolean;
  status?: SourceStatus;
}

// =============================================================================
// SourceSync Types
// =============================================================================

export type SyncType = 'full' | 'incremental';
export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SourceSync {
  id: string;
  organization: string;
  data_source: string;
  sync_type: SyncType;
  status: SyncStatus;
  started_at: string | null;
  completed_at: string | null;
  items_synced: number;
  items_created: number;
  items_updated: number;
  items_failed: number;
  error_message: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// SourceMapping Types
// =============================================================================

export type ContentType = 'article' | 'category';

export interface SourceMapping {
  id: string;
  organization: string;
  data_source: string;
  external_id: string;
  external_url: string;
  content_type: ContentType;
  mapped_article: string | null;
  mapped_category: string | null;
  last_synced_at: string | null;
  sync_status: SyncStatus;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// SiteDiscovery Types
// =============================================================================

export type DiscoveryStatus = 'pending' | 'crawling' | 'analyzing' | 'completed' | 'failed';

export interface SiteDiscovery {
  id: string;
  organization: string;
  product: string;
  initial_url: string;
  status: DiscoveryStatus;
  discovered_pages: DiscoveredPage[];
  crawl_stats: CrawlStats;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  content_type: string;
  word_count: number;
  is_selected: boolean;
}

export interface CrawlStats {
  total_pages: number;
  analyzed_pages: number;
  failed_pages: number;
  crawl_depth: number;
}

export interface CreateSiteDiscoveryPayload {
  product: string;
  initial_url: string;
}

// =============================================================================
// GitHubRepository Types
// =============================================================================

export type IndexingStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface GitHubRepository {
  id: string;
  organization: string;
  data_source: string;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  description: string;
  is_private: boolean;
  indexing_status: IndexingStatus;
  indexing_error: string;
  last_indexed_commit: string;
  last_indexed_at: string | null;
  file_patterns: string[];
  exclude_patterns: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateGitHubRepositoryPayload {
  data_source: string;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch?: string;
  description?: string;
  is_private?: boolean;
  file_patterns?: string[];
  exclude_patterns?: string[];
}

export interface UpdateGitHubRepositoryPayload {
  default_branch?: string;
  file_patterns?: string[];
  exclude_patterns?: string[];
  indexing_status?: IndexingStatus;
}

// =============================================================================
// GitHubPullRequest Types
// =============================================================================

export type PRProcessingStatus = 'pending' | 'processing' | 'processed' | 'skipped' | 'failed';

export interface GitHubPullRequest {
  id: string;
  organization: string;
  repository: string;
  pr_number: number;
  title: string;
  description: string;
  author: string;
  base_branch: string;
  head_branch: string;
  merged_at: string | null;
  processing_status: PRProcessingStatus;
  processing_error: string;
  analyzed_at: string | null;
  analysis_result: PRAnalysisResult;
  created_at: string;
  updated_at: string;
}

export interface PRAnalysisResult {
  summary?: string;
  affected_areas?: string[];
  documentation_impact?: 'none' | 'minor' | 'major';
  suggested_updates?: string[];
  [key: string]: unknown;
}

// =============================================================================
// CodeChunk Types
// =============================================================================

export type ChunkType = 'function' | 'class' | 'module' | 'documentation' | 'other';

export interface CodeChunk {
  id: string;
  organization: string;
  repository: string;
  file_path: string;
  file_sha: string;
  chunk_index: number;
  chunk_type: ChunkType;
  name: string;
  content: string;
  language: string;
  start_line: number;
  end_line: number;
  embedding: number[] | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// BucketConnection Types
// =============================================================================

export type BucketConnectionType = 's3' | 'gcs';
export type BucketSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface BucketConnection {
  id: string;
  organization: string;
  data_source: string;
  connection_type: BucketConnectionType;
  bucket_name: string;
  prefix: string;
  region: string;
  credentials: BucketCredentials;
  file_patterns: string[];
  exclude_patterns: string[];
  last_sync_at: string | null;
  last_sync_status: BucketSyncStatus;
  last_sync_error: string;
  created_at: string;
  updated_at: string;
}

export interface BucketCredentials {
  access_key_id?: string;
  secret_access_key?: string;
  service_account_json?: string;
  [key: string]: unknown;
}

export interface CreateBucketConnectionPayload {
  data_source: string;
  connection_type: BucketConnectionType;
  bucket_name: string;
  prefix?: string;
  region?: string;
  credentials: BucketCredentials;
  file_patterns?: string[];
  exclude_patterns?: string[];
}

export interface UpdateBucketConnectionPayload {
  bucket_name?: string;
  prefix?: string;
  region?: string;
  credentials?: Partial<BucketCredentials>;
  file_patterns?: string[];
  exclude_patterns?: string[];
}

// =============================================================================
// BucketSyncLog Types
// =============================================================================

export interface BucketSyncLog {
  id: string;
  organization: string;
  bucket_connection: string;
  status: BucketSyncStatus;
  started_at: string | null;
  completed_at: string | null;
  files_synced: number;
  files_failed: number;
  bytes_synced: number;
  error_message: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type DataSourceListResponse = PaginatedResponse<DataSource>;
export type SourceSyncListResponse = PaginatedResponse<SourceSync>;
export type SourceMappingListResponse = PaginatedResponse<SourceMapping>;
export type SiteDiscoveryListResponse = PaginatedResponse<SiteDiscovery>;
export type GitHubRepositoryListResponse = PaginatedResponse<GitHubRepository>;
export type GitHubPullRequestListResponse = PaginatedResponse<GitHubPullRequest>;
export type CodeChunkListResponse = PaginatedResponse<CodeChunk>;
export type BucketConnectionListResponse = PaginatedResponse<BucketConnection>;
export type BucketSyncLogListResponse = PaginatedResponse<BucketSyncLog>;
