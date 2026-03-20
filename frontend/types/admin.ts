// ============================================================================
// Help Center Admin Types
// ============================================================================

// Re-export source types for convenience
export * from './sources';

// --- Article Types ---

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export interface ArticleContent {
  /** Markdown content */
  markdown: string;
  last_updated: string;
}

export interface OptimizedContent extends ArticleContent {
  model_used: string;
  optimized_at: string;
  improvements: string[];
}

// User summary for ownership display
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  
  // Status
  status: ArticleStatus;
  
  // Content (dual-track system)
  content: {
    original: ArticleContent;
    optimized?: OptimizedContent;
    active: 'original' | 'optimized';
  };
  
  // Organization
  category_id: string;
  category_name?: string;
  category_slug?: string;
  category_path?: string[];
  tags: string[];
  personas: string[];
  
  // Source tracking
  source_id?: string;
  source_name?: string;
  source_url?: string;
  source_last_modified?: string;
  is_stale: boolean;
  
  // SEO
  meta_title?: string;
  meta_description?: string;
  
  // Analytics (summary)
  views_30d: number;
  helpful_votes: number;
  unhelpful_votes: number;
  helpful_percentage: number;
  
  // Ownership
  owner?: string;  // UUID
  owner_details?: UserSummary;
  last_edited_by?: string;  // UUID
  last_edited_by_details?: UserSummary;
  show_owner?: boolean | null;  // null = inherit from config
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// --- Tooltip Types ---

export type TooltipStatus = 'ai_suggested' | 'draft' | 'published' | 'archived';
export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'icon';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface AdminTooltip {
  id: string;
  help_center_config: string;
  
  // Identity
  name: string;                    // Internal name: "Garnishment type selector"
  tooltip_id: string;              // Dev-facing ID: "garnishment-type-select"
  
  // Content
  content: string;                 // Markdown text (max ~200 chars)
  content_html: string;            // Rendered HTML
  
  // Relationship to article
  article_id?: string;             // Optional linked article
  article_title?: string;          // For display
  article_slug?: string;           // For "Learn more" link
  show_learn_more: boolean;        // Show "Learn more →" link
  
  // Display options
  trigger: TooltipTrigger;
  position: TooltipPosition;
  
  // Status (same pattern as Articles)
  status: TooltipStatus;
  
  // AI metadata
  ai_generated: boolean;
  ai_suggested_placement?: string;  // "Next to the garnishment dropdown"
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface TooltipFilters {
  status?: TooltipStatus | 'all';
  article_id?: string;
  ai_generated?: boolean;
  search?: string;
}

export interface AdminTooltipListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminTooltip[];
}

// --- Category Types ---

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  
  // Hierarchy
  parent_id?: string;
  path: string[];
  depth: number;
  order: number;
  
  // Content
  article_count: number;
  published_article_count: number;
  
  // Nested children (for tree view)
  children?: AdminCategory[];
  
  // Source tracking
  source_id?: string;
  
  created_at: string;
  updated_at: string;
}

// --- Source Types ---

export type SourceType = 
  | 'zendesk' 
  | 'intercom' 
  | 'notion' 
  | 'website' 
  | 'changelog'
  | 'manual';

export type SourceStatus = 'active' | 'syncing' | 'error' | 'paused';

export interface AdminSource {
  id: string;
  name: string;
  source_type: SourceType;
  
  // Connection details
  connection: {
    url?: string;
    api_key?: string;
    subdomain?: string;
  };
  
  // Sync configuration
  sync: {
    auto_sync: boolean;
    sync_frequency_hours: number;
    last_synced_at: string | null;
    next_sync_at: string | null;
  };
  
  // Content stats
  stats: {
    total_articles: number;
    published_articles: number;
    pending_review: number;
    stale_articles: number;
    last_change_detected: string | null;
  };
  
  // Status
  status: SourceStatus;
  error_message?: string;
  
  created_at: string;
  updated_at: string;
}

// --- Dashboard Types ---

export interface DashboardStats {
  articles: {
    total: number;
    published: number;
    drafts: number;
    review: number;
    change_this_week: number;
  };
  views: {
    total_30d: number;
    change_percentage: number;
  };
  searches: {
    total_30d: number;
    resolved_percentage: number;
  };
  helpfulness: {
    percentage: number;
    change_percentage: number;
  };
}

export interface NeedsAttentionItem {
  type: 'stale' | 'low_performing' | 'pending_review';
  count: number;
  message: string;
  link: string;
}

export interface ActivityItem {
  id: string;
  type: 'article_edited' | 'article_published' | 'source_synced' | 'article_created';
  title: string;
  description: string;
  timestamp: string;
  article_id?: string;
  source_id?: string;
}

export interface AISuggestion {
  id: string;
  type: 'content_gap' | 'optimization' | 'stale_content';
  title: string;
  description: string;
  action_label: string;
  action_link: string;
  priority: 'low' | 'medium' | 'high';
}

// --- User Types ---

export interface AdminOrganization {
  id: string;
  name: string;
  role: 'admin' | 'member';
  plan?: string;
  subscription_status?: string;
  billing_email?: string;
}

export interface AdminProduct {
  id: string;
  organization_id: string;
  name: string;
  subdomain?: string;
  website_url?: string;
  public_url?: string;
  is_default: boolean;
  default_language?: import('@/types/v2/products').LanguageCode;
  agent_guidance?: string;
  config?: {
    branding?: import('@/types/config').BrandingConfig;
    ai?: import('@/types/config').AIConfig;
    embed?: import('@/types/config').EmbedConfig;
    [key: string]: unknown;
  };
  // Code-first action sync settings
  sync_secret_configured?: boolean;
  sync_secrets_count?: number;
}

/** @deprecated Use AdminProduct instead */
export type AdminHelpCenterConfig = AdminProduct;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'editor' | 'viewer';
  organizations?: AdminOrganization[];
  primary_organization_id?: string | null;
  last_selected_product_id?: string | null;
}

// --- API Response Types ---

export interface AdminArticleListResponse {
  articles: AdminArticle[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface AdminCategoryTreeResponse {
  categories: AdminCategory[];
  uncategorized_count: number;
}

// --- Filter Types ---

export interface ArticleFilters {
  status?: ArticleStatus | 'all';
  category_id?: string;
  source_id?: string;
  is_stale?: boolean;
  has_optimization?: boolean;
  search?: string;
}

// ============================================================================
// AI Agent Types
// ============================================================================

// --- Agent Core Types ---

export type AgentType = 'librarian' | 'drafter' | 'gardener';
export type AgentStatus = 'idle' | 'active' | 'running' | 'paused' | 'error';

export interface AgentOverview {
  id: AgentType;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: 'cyan' | 'rose' | 'emerald';
  status: AgentStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  pendingActions: number;
  recentActivity: string[];
  runsOn: string;
}

// --- Librarian Types ---

export interface DuplicateSuggestion {
  id: string;
  article1: { id: string; title: string; slug: string };
  article2: { id: string; title: string; slug: string };
  similarityScore: number;
  createdAt: string;
}

export interface TagSuggestion {
  id: string;
  tag: string;
  articles: { id: string; title: string }[];
  createdAt: string;
}

export interface LibrarianStats {
  articlesProcessed: number;
  categoriesAssigned: number;
  tagsSuggested: number;
  duplicatesFound: number;
}

export interface LibrarianConfig {
  autoCategorize: boolean;
  detectDuplicates: boolean;
  findRelatedArticles: boolean;
  suggestTags: boolean;
  minSimilarityThreshold: number;
}

// --- Drafter Types ---

export interface DraftArticle {
  id: string;
  title: string;
  content: string;
  suggestedCategory: string;
  confidence: number;
  sources: DraftSource[];
  createdAt: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface DraftSource {
  type: 'ticket' | 'slack' | 'email' | 'forum';
  id: string;
  title: string;
  snippet: string;
  url?: string;
}

export interface DrafterConfig {
  triggerThreshold: number;
  minConfidence: number;
  sources: {
    tickets: boolean;
    slack: boolean;
    email: boolean;
    forum: boolean;
  };
}

// --- Gardener Types ---

export interface StaleArticle {
  id: string;
  title: string;
  slug: string;
  reason: string;
  detectedSource: string;
  screenshotsToRefresh: number;
  suggestedUpdate?: string;
  flaggedAt: string;
}

export interface ScreenshotRefreshItem {
  id: string;
  articleId: string;
  articleTitle: string;
  screenshotUrl: string;
  pageUrl: string;
  status: 'pending' | 'refreshing' | 'completed' | 'failed';
}

export interface FreshnessReport {
  totalArticles: number;
  freshCount: number;
  needsReviewCount: number;
  staleCount: number;
  lastFullCheck: string;
}

export interface GardenerConfig {
  checkFrequencyHours: number;
  monitoredSources: {
    productChangelog?: string;
    apiChangelog?: string;
    githubReleases?: string;
  };
  autoRefreshScreenshots: boolean;
  staleThresholdDays: number;
}

// --- Agent Activity Types ---

export interface AgentActivityItem {
  id: string;
  agentType: AgentType;
  action: string;
  description: string;
  timestamp: string;
  articleId?: string;
}

// ============================================================================
// Analytics Types - Focused on AI chat metrics
// ============================================================================

// --- Date Range ---

export interface AnalyticsDateRange {
  start: string;
  end: string;
  preset?: '7d' | '30d' | '90d' | 'custom';
}

// --- Article Performance (for analytics) ---

export interface ArticlePerformance {
  id: string;
  title: string;
  views: number;
  helpfulPercentage: number;
  avgTimeOnPage: number;
  category: string;
}

// --- Search Analytics Types ---

export interface SearchQuery {
  query: string;
  count: number;
  clicks: number;
  ctr: number;
  hasResults: boolean;
  topResult: { id: string; title: string } | null;
}

// --- AI Usage Stats ---

export interface AIUsageStats {
  totalConversations: number;
  changePercent: number;
  resolutionRate: number;
  resolvedCount: number;
  escalatedCount: number;
  avgMessagesPerChat: number;
  totalMessages: number;
  topQuestions: { question: string; count: number; articleId?: string }[];
  escalationReasons: { reason: string; count: number }[];
  feedback: {
    helpfulCount: number;
    unhelpfulCount: number;
    helpfulRate: number;
  };
}

export interface AIUsageResponse {
  stats: AIUsageStats;
  dateRange: AnalyticsDateRange;
}

// --- Conversations Trend ---

export interface ConversationsTrendData {
  date: string;
  count: number;
}

export interface ConversationsTrendResponse {
  data: ConversationsTrendData[];
  dateRange: AnalyticsDateRange;
}

// ============================================================================
// Chat Conversation Types
// ============================================================================

export type ConversationStatus = 'active' | 'resolved' | 'escalated' | 'abandoned';
export type MessageRole = 'user' | 'assistant';
export type MessageFeedback = 'none' | 'up' | 'down';
export type QueryType = 'ask' | 'search';

export interface ChunkDetail {
  chunk_id: string;
  score: number;
  title?: string;
  content_preview?: string;
  source_article_id?: string;
  source_title?: string;
  heading_path?: string[];
}

// Enhanced reasoning trace types for capturing agent decision-making process
export interface SourceEvaluation {
  title: string;
  url: string;
  score: number;
  citation_num?: number;
  content_preview: string;
  was_used: boolean;
  rejection_reason?: string;
}

/** Candidate action from action search */
export interface ActionCandidate {
  name: string;
  description: string;
  score: number;
  auto_run: boolean;
}

export interface ReasoningStep {
  step_type: 'action_search' | 'decision' | 'search' | 'source_eval' | 'action' | 'answer';
  iteration: number;
  timestamp_ms: number;
  
  // Legacy/simple step fields (for backwards compatibility)
  action?: string;
  observation?: string;
  
  // Action search step fields
  query?: string;
  actions_found?: number;
  top_action?: string;
  top_score?: number;
  action_candidates?: ActionCandidate[];
  // Rerank metadata (when reranking is enabled)
  rerank_enabled?: boolean;
  rerank_time_ms?: number;
  embedding_top_action?: string;
  rerank_changed_top?: boolean;
  
  // Decision step fields
  decision?: string;
  thought?: string;
  confidence?: number;
  // Action name for RETURN_ACTION/CALL_ACTION decisions
  action_name?: string;
  
  // Search step fields
  search_query?: string;
  search_type?: string;
  results_count?: number;
  quality_results_count?: number;
  new_sources_added?: number;
  
  // Source evaluation fields
  sources_evaluated?: SourceEvaluation[];
  
  // Action step fields (action_name is shared with decision step above)
  action_params?: Record<string, unknown>;
  action_matched?: boolean;
  
  // Answer step fields
  sources_used_count?: number;
  answer_strategy?: string;
}

/** Lightweight correction info embedded in messages */
export interface MessageCorrection {
  id: string;
  status: CorrectionStatus;
  correction_type: CorrectionType;
  processed_title: string;
  processed_content: string;
  user_correction_notes: string;
  created_at: string;
  knowledge_item: string | null;
  knowledge_item_source_id: string | null;
}

export interface ChatMessage {
  id: string;
  conversation: string;
  role: MessageRole;
  content: string;
  chunks_retrieved: Array<{
    chunk_id: string;
    score: number;
    source_article_id?: string;
  }>;
  chunks_details?: ChunkDetail[];
  model_used: string;
  latency_ms: number | null;
  feedback: MessageFeedback;
  feedback_comment: string;
  feedback_timestamp?: string | null;
  timestamp: string;
  created_at: string;
  updated_at: string;
  // Enhanced fields from AIQueryLog
  query_type?: QueryType;
  query_hash?: string;
  intent_category?: string;
  intent_confidence?: number | null;
  was_stopped?: boolean;
  tokens_generated?: number | null;
  reasoning_trace?: ReasoningStep[];
  primary_cluster?: string | null;
  cluster_confidence?: number | null;
  // Existing correction for this message (if any)
  correction?: MessageCorrection | null;
}

export interface VisitorSummary {
  id: string;
  visitor_id: string;
  external_user_id: string | null;
  name: string;
  email: string;
}

export interface ChatConversationListItem {
  id: string;
  status: ConversationStatus;
  page_url: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  first_user_message: string | null;
  last_assistant_message: string | null;
  has_negative_feedback: boolean;
  escalation_reason: string;
  escalated_to: string;
  created_at: string;
  updated_at: string;
  // Enhanced fields
  title?: string;
  external_session_id?: string;
  logging_enabled?: boolean;
  visitor?: VisitorSummary | null;
  // Agent / Channel fields
  channel?: string;
  agent_name?: string | null;
}

export interface ChatConversationDetail {
  id: string;
  session: string | null;
  status: ConversationStatus;
  page_url: string;
  product_context: Record<string, unknown>;
  escalation_reason: string;
  escalated_to: string;
  started_at: string;
  last_message_at: string;
  messages: ChatMessage[];
  message_count: number;
  has_negative_feedback: boolean;
  created_at: string;
  updated_at: string;
  // Enhanced fields
  title?: string;
  user_agent?: string;
  ip_address?: string | null;
  referer?: string;
  external_session_id?: string;
  logging_enabled?: boolean;
  metadata?: Record<string, unknown>;
  visitor?: VisitorSummary | null;
}

export interface ConversationsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ChatConversationListItem[];
}

export interface ConversationFilters {
  status?: ConversationStatus;
  started_at_gte?: string;
  started_at_lte?: string;
  has_negative_feedback?: boolean;
  query_type?: string;
  intent_category?: string;
  channel?: string;
  agent?: string;
  search?: string;
  page?: number;
  page_size?: number;
  has_reasoning_trace?: boolean;
}

// ============================================================================
// Correction Types
// ============================================================================

export type CorrectionStatus = 'pending' | 'processing' | 'processed' | 'indexed' | 'failed';
export type CorrectionType = 'response' | 'reasoning' | 'source' | 'search';

export interface CorrectSource {
  title: string;
  should_rank: number;
}

export interface Correction {
  id: string;
  status: CorrectionStatus;
  correction_type: CorrectionType;
  original_question: string;
  original_response: string;
  user_correction_notes: string;
  processed_title: string;
  processed_content: string;
  knowledge_item: string | null;
  knowledge_item_title: string | null;
  source_conversation: string | null;
  source_message: string | null;
  processing_error: string;
  // Reasoning context
  reasoning_step_index: number | null;
  reasoning_step_type: string;
  full_reasoning_trace: ReasoningStep[];
  original_reasoning_step: ReasoningStep | null;
  // Type-specific correction data
  correct_reasoning: string;
  correct_search_query: string;
  correct_sources: CorrectSource[];
  // Audit
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Context quote from text selection in conversation/reasoning */
export interface ContextQuote {
  text: string;
  source: 'message' | 'reasoning';
  step_index?: number;
  step_type?: string;
}

export interface CreateCorrectionRequest {
  message_id: string;
  correction_notes: string;
  // New mode: context quotes from text selection
  context_quotes?: ContextQuote[];
  // Legacy mode fields
  correction_type?: CorrectionType;
  // For reasoning corrections
  reasoning_step_index?: number;
  correct_reasoning?: string;
  // For search corrections
  correct_search_query?: string;
  // For source corrections
  correct_sources?: CorrectSource[];
}

export interface CreateCorrectionResponse {
  id: string;
  status: CorrectionStatus;
  correction_type?: CorrectionType;
  processed_title?: string;
  processed_content?: string;
  knowledge_item_id?: string | null;
  error?: string;
}

// ============================================================================
// AI Assistant Panel Types
// ============================================================================

// --- Content Assistant Types ---

export type AssistantContentType = 'article' | 'category';

export type AssistantSuggestionType =
  | 'missing_seo'
  | 'tag_recommendations'
  | 'category_mismatch'
  | 'content_gap'
  | 'stale_content'
  | 'related_articles'
  | 'missing_description';

export interface AssistantSuggestionAction {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
}

export interface AssistantSuggestion {
  id: string;
  type: AssistantSuggestionType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  data: Record<string, unknown>;
  actions: AssistantSuggestionAction[];
}

// --- Quick Action Result Types ---

export interface SEOGenerationResult {
  meta_title: string;
  meta_description: string;
  slug_suggestion?: string;
}

export interface TagSuggestionResult {
  suggested_tags: string[];
  confidence: number;
  reasoning?: string;
}

export interface CategorySuggestionResult {
  category_id: string;
  category_name: string;
  confidence: number;
  reason: string;
  alternative_categories?: Array<{
    category_id: string;
    category_name: string;
    confidence: number;
  }>;
}

export interface ContentImprovementResult {
  improved_content: string;
  changes_summary: string[];
  diff?: string;
}

// --- Assistant API Response Types ---

export interface AnalyzeContentResponse {
  suggestions: AssistantSuggestion[];
  analyzed_at: string;
}

export interface AssistantActionResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}



