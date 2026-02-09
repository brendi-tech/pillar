/**
 * V2 Content Types
 *
 * Types for the new content app models:
 * - Article (formerly HelpArticle)
 * - Category (formerly HelpCategory)
 * - ArticleVersion
 * - ArticleLocalization
 * - ArticleRelationship
 * - ArticleFeedback
 * - Persona
 * - Tutorial
 * - TutorialStep
 */

// =============================================================================
// Article Types (formerly HelpArticle)
// =============================================================================

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type SourceType = 'manual' | 'ai_generated' | 'imported' | 'synced';

export interface Article {
  id: string;
  organization: string;
  product: string;
  category: string | null;
  category_name?: string;
  category_slug?: string;
  title: string;
  slug: string;
  body_markdown: string;
  excerpt: string;
  featured_image_url: string;
  video_url: string;
  status: ArticleStatus;
  source_type: SourceType;
  source_reference: string | null;
  data_source: string | null;
  position: number;
  is_internal: boolean;
  published_at: string | null;
  helpful_count: number;
  not_helpful_count: number;
  view_count: number;
  last_indexed_at: string | null;
  indexing_failed: boolean;
  indexing_error: string | null;
  embedding: number[] | null;
  // Ownership
  owner: string | null;
  owner_details?: UserSummary;
  last_edited_by: string | null;
  last_edited_by_details?: UserSummary;
  show_owner: boolean | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Relations
  personas?: string[];
  related_articles?: string[];
}

export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export interface CreateArticlePayload {
  product: string;
  category?: string;
  title: string;
  slug?: string;
  body_markdown?: string;
  excerpt?: string;
  status?: ArticleStatus;
  source_type?: SourceType;
  position?: number;
  is_internal?: boolean;
  personas?: string[];
  related_articles?: string[];
  owner?: string;
}

export interface UpdateArticlePayload {
  category?: string | null;
  title?: string;
  slug?: string;
  body_markdown?: string;
  excerpt?: string;
  featured_image_url?: string;
  video_url?: string;
  status?: ArticleStatus;
  source_type?: SourceType;
  position?: number;
  is_internal?: boolean;
  personas?: string[];
  related_articles?: string[];
  owner?: string | null;
  show_owner?: boolean | null;
}

// =============================================================================
// Category Types (formerly HelpCategory)
// =============================================================================

export interface Category {
  id: string;
  organization: string;
  product: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  position: number;
  is_visible: boolean;
  parent: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  article_count?: number;
  published_article_count?: number;
  children?: Category[];
  depth?: number;
  path?: string[];
}

export interface CreateCategoryPayload {
  product: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  position?: number;
  is_visible?: boolean;
  parent?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  position?: number;
  is_visible?: boolean;
  parent?: string | null;
}

// =============================================================================
// ArticleVersion Types
// =============================================================================

export interface ArticleVersion {
  id: string;
  organization: string;
  article: string;
  version: string;
  title: string;
  body_markdown: string;
  is_default: boolean;
  created_by: string | null;
  created_by_details?: UserSummary;
  created_at: string;
  updated_at: string;
}

export interface CreateArticleVersionPayload {
  article: string;
  version: string;
  title?: string;
  body_markdown?: string;
  is_default?: boolean;
}

// =============================================================================
// ArticleLocalization Types
// =============================================================================

export interface ArticleLocalization {
  id: string;
  organization: string;
  article: string;
  locale: string;
  title: string;
  slug: string;
  body_markdown: string;
  excerpt: string;
  status: ArticleStatus;
  translation_source: 'manual' | 'ai_translated';
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateArticleLocalizationPayload {
  article: string;
  locale: string;
  title: string;
  slug?: string;
  body_markdown?: string;
  excerpt?: string;
  status?: ArticleStatus;
}

export interface UpdateArticleLocalizationPayload {
  title?: string;
  slug?: string;
  body_markdown?: string;
  excerpt?: string;
  status?: ArticleStatus;
  needs_review?: boolean;
}

// =============================================================================
// ArticleRelationship Types
// =============================================================================

export type RelationshipCreatedByType = 'user' | 'ai_suggested' | 'automated';
export type RelationshipStatus = 'suggested' | 'approved' | 'rejected';

export interface ArticleRelationship {
  id: string;
  organization: string;
  source_article: string;
  source_article_title?: string;
  target_article: string;
  target_article_title?: string;
  relationship_description: string;
  relationship_type: string;
  similarity_score: number | null;
  created_by_type: RelationshipCreatedByType;
  status: RelationshipStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  suggestion: string | null;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateArticleRelationshipPayload {
  source_article: string;
  target_article: string;
  relationship_description: string;
  relationship_type?: string;
  status?: RelationshipStatus;
}

export interface UpdateArticleRelationshipPayload {
  relationship_description?: string;
  relationship_type?: string;
  status?: RelationshipStatus;
}

// =============================================================================
// ArticleFeedback Types
// =============================================================================

export type FeedbackType = 'inline' | 'general';
export type FeedbackStatus = 'pending' | 'addressed' | 'dismissed' | 'in_progress';
export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface ArticleFeedback {
  id: string;
  organization: string;
  content_type: string;
  object_id: string;
  feedback_type: FeedbackType;
  highlighted_text: string;
  start_offset: number | null;
  end_offset: number | null;
  feedback_text: string;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  resolution_notes: string;
  resolved_at: string | null;
  created_by: string | null;
  created_by_details?: UserSummary;
  created_at: string;
  updated_at: string;
}

export interface CreateArticleFeedbackPayload {
  content_type: string;
  object_id: string;
  feedback_type?: FeedbackType;
  highlighted_text?: string;
  start_offset?: number;
  end_offset?: number;
  feedback_text: string;
  severity?: FeedbackSeverity;
}

export interface UpdateArticleFeedbackPayload {
  feedback_text?: string;
  severity?: FeedbackSeverity;
  status?: FeedbackStatus;
  resolution_notes?: string;
}

// =============================================================================
// Persona Types
// =============================================================================

export interface Persona {
  id: string;
  organization: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonaPayload {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdatePersonaPayload {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
  is_default?: boolean;
}

// =============================================================================
// Tutorial Types
// =============================================================================

export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Tutorial {
  id: string;
  organization: string;
  title: string;
  slug: string;
  description: string;
  difficulty: TutorialDifficulty;
  estimated_minutes: number;
  is_published: boolean;
  published_at: string | null;
  personas: string[];
  prerequisite_tutorials: string[];
  created_at: string;
  updated_at: string;
  // Computed
  steps?: TutorialStep[];
  step_count?: number;
}

export interface CreateTutorialPayload {
  title: string;
  slug?: string;
  description?: string;
  difficulty?: TutorialDifficulty;
  estimated_minutes?: number;
  is_published?: boolean;
  personas?: string[];
  prerequisite_tutorials?: string[];
}

export interface UpdateTutorialPayload {
  title?: string;
  slug?: string;
  description?: string;
  difficulty?: TutorialDifficulty;
  estimated_minutes?: number;
  is_published?: boolean;
  personas?: string[];
  prerequisite_tutorials?: string[];
}

// =============================================================================
// TutorialStep Types
// =============================================================================

export interface TutorialStep {
  id: string;
  organization: string;
  tutorial: string;
  order: number;
  title: string;
  content: string;
  screenshot_url: string;
  page_url: string;
  element_selector: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTutorialStepPayload {
  tutorial: string;
  order: number;
  title: string;
  content?: string;
  screenshot_url?: string;
  page_url?: string;
  element_selector?: string;
}

export interface UpdateTutorialStepPayload {
  order?: number;
  title?: string;
  content?: string;
  screenshot_url?: string;
  page_url?: string;
  element_selector?: string;
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

export type ArticleListResponse = PaginatedResponse<Article>;
export type CategoryListResponse = PaginatedResponse<Category>;
export type ArticleVersionListResponse = PaginatedResponse<ArticleVersion>;
export type ArticleLocalizationListResponse = PaginatedResponse<ArticleLocalization>;
export type ArticleRelationshipListResponse = PaginatedResponse<ArticleRelationship>;
export type ArticleFeedbackListResponse = PaginatedResponse<ArticleFeedback>;
export type PersonaListResponse = PaginatedResponse<Persona>;
export type TutorialListResponse = PaginatedResponse<Tutorial>;
export type TutorialStepListResponse = PaginatedResponse<TutorialStep>;
