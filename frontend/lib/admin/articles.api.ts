/**
 * Articles API module for Help Center admin dashboard.
 * 
 * Note: The help center is read-only. Content is imported from external sources.
 * Create/update operations are kept for backwards compatibility but not used in UI.
 */
import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';
import type {
  ArticleFilters,
  ArticleStatus,
  AdminArticle,
} from '@/types/admin';

// ============================================================================
// API Payload Types (match backend serializers)
// Note: Create/update not used in read-only help center, but kept for compatibility
// ============================================================================

/**
 * Payload for creating a new article.
 * Note: Help center is read-only - this is for backwards compatibility only.
 */
export interface CreateArticlePayload {
  site: string;
  category?: string;
  slug?: string;
  title: string;
  body_markdown?: string;
  excerpt?: string;
  version?: string;
  meta_title?: string;
  meta_description?: string;
  status?: ArticleStatus;
  source_type?: string;
  source_reference?: string;
  position?: number;
  related_articles?: string[];
  personas?: string[];
  tags?: string[];
}

/**
 * Payload for updating an article.
 * Note: Help center is read-only - this is for backwards compatibility only.
 */
export interface UpdateArticlePayload {
  category?: string;
  slug?: string;
  title?: string;
  body_markdown?: string;
  excerpt?: string;
  status?: ArticleStatus;
  source_type?: string;
  source_reference?: string;
  position?: number;
  related_articles?: string[];
  personas?: string[];
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
}

/**
 * User summary for ownership display.
 */
export interface BackendUserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

/**
 * Backend article response type.
 * Matches HelpArticleSerializer output.
 */
export interface BackendArticle {
  id: string;
  site: string;
  organization: string;
  category: string | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  slug: string;
  /** Markdown content (primary format) */
  body_markdown: string;
  excerpt: string;
  status: ArticleStatus;
  published_at: string | null;
  source_type: string;
  source_reference: string | null;
  position: number;
  related_articles: string[];
  personas: string[];
  helpful_count: number;
  not_helpful_count: number;
  view_count: number;
  last_indexed_at: string | null;
  indexing_failed: boolean;
  indexing_error: string | null;
  created_at: string;
  updated_at: string;
  // Ownership fields
  owner: string | null;
  owner_details: BackendUserSummary | null;
  last_edited_by: string | null;
  last_edited_by_details: BackendUserSummary | null;
  show_owner: boolean | null;
}

/**
 * Article list response from backend.
 */
export interface BackendArticleListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BackendArticle[];
}

/**
 * Article stats response.
 */
export interface ArticleStats {
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  helpfulness_score: number | null;
}

// ============================================================================
// Articles API
// ============================================================================

export const articlesAPI = {
  /**
   * List articles with filters and pagination.
   */
  list: async (
    params?: ArticleFilters & { page?: number; page_size?: number }
  ): Promise<BackendArticleListResponse> => {
    const apiParams: Record<string, string | number | boolean | undefined> = {
      page: params?.page,
      page_size: params?.page_size,
      search: params?.search,
      category: params?.category_id,
      is_stale: params?.is_stale,
    };

    // Only add status if it's not 'all'
    if (params?.status && params.status !== 'all') {
      apiParams.status = params.status;
    }

    return await adminFetch<BackendArticleListResponse>('/knowledge/items/', { params: apiParams });
  },

  /**
   * Get a single article by ID.
   */
  get: async (id: string): Promise<BackendArticle> => {
    return await adminFetch<BackendArticle>(`/knowledge/items/${id}/`);
  },

  /**
   * Create a new article.
   */
  create: async (data: CreateArticlePayload): Promise<BackendArticle> => {
    return adminPost<BackendArticle>('/knowledge/items/', data);
  },

  /**
   * Update an existing article.
   */
  update: async (id: string, data: UpdateArticlePayload): Promise<BackendArticle> => {
    return adminPatch<BackendArticle>(`/knowledge/items/${id}/`, data);
  },

  /**
   * Delete an article.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete<void>(`/knowledge/items/${id}/`);
  },

  /**
   * Bulk publish multiple articles.
   */
  bulkPublish: async (articleIds: string[]): Promise<{ published: number }> => {
    return adminPost<{ published: number }>('/knowledge/items/bulk-publish/', { article_ids: articleIds });
  },

  /**
   * Bulk archive multiple articles.
   */
  bulkArchive: async (articleIds: string[]): Promise<{ archived: number }> => {
    return adminPost<{ archived: number }>('/knowledge/items/bulk-archive/', { article_ids: articleIds });
  },

  /**
   * Get detailed stats for an article.
   */
  getStats: async (id: string): Promise<ArticleStats> => {
    return adminFetch<ArticleStats>(`/knowledge/items/${id}/stats/`);
  },
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform a backend article to the frontend AdminArticle format.
 */
export function transformBackendArticle(article: BackendArticle): AdminArticle {
  const totalVotes = article.helpful_count + article.not_helpful_count;
  const helpfulPercentage = totalVotes > 0 
    ? Math.round((article.helpful_count / totalVotes) * 100) 
    : 0;

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt || undefined,
    status: article.status,
    content: {
      original: {
        markdown: article.body_markdown,
        last_updated: article.updated_at,
      },
      active: 'original',
    },
    category_id: article.category || '',
    category_name: article.category_name || undefined,
    category_slug: article.category_slug || undefined,
    category_path: article.category_name ? [article.category_name] : undefined,
    tags: [], // Backend doesn't return tags yet
    personas: article.personas || [],
    is_stale: false, // TODO: Calculate from source data
    views_30d: article.view_count,
    helpful_votes: article.helpful_count,
    unhelpful_votes: article.not_helpful_count,
    helpful_percentage: helpfulPercentage,
    created_at: article.created_at,
    updated_at: article.updated_at,
    published_at: article.published_at || undefined,
    // Ownership fields
    owner: article.owner || undefined,
    owner_details: article.owner_details || undefined,
    last_edited_by: article.last_edited_by || undefined,
    last_edited_by_details: article.last_edited_by_details || undefined,
    show_owner: article.show_owner,
  };
}

/**
 * Transform a list of backend articles to frontend format.
 */
export function transformBackendArticles(articles: BackendArticle[]): AdminArticle[] {
  return articles.map(transformBackendArticle);
}
