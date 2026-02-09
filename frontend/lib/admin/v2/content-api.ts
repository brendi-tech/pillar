/**
 * V2 Content API
 *
 * API functions for the content app:
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

import { v2Fetch, v2Post, v2Patch, v2Delete, v2FetchWithProduct, v2PostWithProduct } from './api-client';
import type {
  Article,
  ArticleListResponse,
  CreateArticlePayload,
  UpdateArticlePayload,
  ArticleStatus,
  Category,
  CategoryListResponse,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  ArticleVersion,
  ArticleVersionListResponse,
  CreateArticleVersionPayload,
  ArticleLocalization,
  ArticleLocalizationListResponse,
  CreateArticleLocalizationPayload,
  UpdateArticleLocalizationPayload,
  ArticleRelationship,
  ArticleRelationshipListResponse,
  CreateArticleRelationshipPayload,
  UpdateArticleRelationshipPayload,
  RelationshipStatus,
  ArticleFeedback,
  ArticleFeedbackListResponse,
  CreateArticleFeedbackPayload,
  UpdateArticleFeedbackPayload,
  FeedbackStatus,
  Persona,
  PersonaListResponse,
  CreatePersonaPayload,
  UpdatePersonaPayload,
  Tutorial,
  TutorialListResponse,
  CreateTutorialPayload,
  UpdateTutorialPayload,
  TutorialStep,
  TutorialStepListResponse,
  CreateTutorialStepPayload,
  UpdateTutorialStepPayload,
} from '@/types/v2/content';

// =============================================================================
// Articles API
// =============================================================================

export const articlesAPI = {
  /**
   * List all articles for the product.
   */
  list: async (params?: {
    category?: string;
    status?: ArticleStatus | 'all';
    is_internal?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<ArticleListResponse> => {
    const apiParams: Record<string, string | number | boolean | undefined> = {
      ...params,
    };
    // Remove 'all' status - backend expects no param for all
    if (apiParams.status === 'all') {
      delete apiParams.status;
    }
    return v2FetchWithProduct<ArticleListResponse>('/knowledge/items/', { params: apiParams });
  },

  /**
   * Get a single article by ID.
   */
  get: async (id: string): Promise<Article> => {
    return v2Fetch<Article>(`/knowledge/items/${id}/`);
  },

  /**
   * Create a new article.
   */
  create: async (data: CreateArticlePayload): Promise<Article> => {
    return v2PostWithProduct<Article>('/knowledge/items/', data);
  },

  /**
   * Update an existing article.
   */
  update: async (id: string, data: UpdateArticlePayload): Promise<Article> => {
    return v2Patch<Article>(`/knowledge/items/${id}/`, data);
  },

  /**
   * Delete an article.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/knowledge/items/${id}/`);
  },

  /**
   * Publish an article.
   */
  publish: async (id: string): Promise<Article> => {
    return v2Post<Article>(`/knowledge/items/${id}/publish/`, {});
  },

  /**
   * Archive an article.
   */
  archive: async (id: string): Promise<Article> => {
    return v2Post<Article>(`/knowledge/items/${id}/archive/`, {});
  },

  /**
   * Bulk publish multiple articles.
   */
  bulkPublish: async (articleIds: string[]): Promise<{ published: number }> => {
    return v2Post<{ published: number }>('/knowledge/items/bulk-publish/', { article_ids: articleIds });
  },

  /**
   * Bulk archive multiple articles.
   */
  bulkArchive: async (articleIds: string[]): Promise<{ archived: number }> => {
    return v2Post<{ archived: number }>('/knowledge/items/bulk-archive/', { article_ids: articleIds });
  },

  /**
   * Get article stats.
   */
  getStats: async (id: string): Promise<{ view_count: number; helpful_count: number; not_helpful_count: number }> => {
    return v2Fetch<{ view_count: number; helpful_count: number; not_helpful_count: number }>(`/knowledge/items/${id}/stats/`);
  },
};

// =============================================================================
// Categories API
// =============================================================================

export const categoriesAPI = {
  /**
   * List all categories for the product.
   */
  list: async (params?: {
    parent?: string;
    is_visible?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<CategoryListResponse> => {
    return v2FetchWithProduct<CategoryListResponse>('/content/categories/', { params });
  },

  /**
   * Get a single category by ID.
   */
  get: async (id: string): Promise<Category> => {
    return v2Fetch<Category>(`/content/categories/${id}/`);
  },

  /**
   * Create a new category.
   */
  create: async (data: CreateCategoryPayload): Promise<Category> => {
    return v2PostWithProduct<Category>('/content/categories/', data);
  },

  /**
   * Update an existing category.
   */
  update: async (id: string, data: UpdateCategoryPayload): Promise<Category> => {
    return v2Patch<Category>(`/content/categories/${id}/`, data);
  },

  /**
   * Delete a category.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/categories/${id}/`);
  },

  /**
   * Get category tree (hierarchical structure).
   */
  getTree: async (): Promise<Category[]> => {
    return v2FetchWithProduct<Category[]>('/content/categories/tree/');
  },

  /**
   * Reorder categories.
   */
  reorder: async (categoryIds: string[]): Promise<void> => {
    return v2Post<void>('/content/categories/reorder/', { category_ids: categoryIds });
  },
};

// =============================================================================
// Article Versions API
// =============================================================================

export const articleVersionsAPI = {
  /**
   * List versions for an article.
   */
  list: async (articleId: string, params?: {
    page?: number;
    page_size?: number;
  }): Promise<ArticleVersionListResponse> => {
    return v2Fetch<ArticleVersionListResponse>('/content/article-versions/', { params: { ...params, article: articleId } });
  },

  /**
   * Get a single version by ID.
   */
  get: async (id: string): Promise<ArticleVersion> => {
    return v2Fetch<ArticleVersion>(`/content/article-versions/${id}/`);
  },

  /**
   * Create a new version.
   */
  create: async (data: CreateArticleVersionPayload): Promise<ArticleVersion> => {
    return v2Post<ArticleVersion>('/content/article-versions/', data);
  },

  /**
   * Set a version as default.
   */
  setDefault: async (id: string): Promise<ArticleVersion> => {
    return v2Post<ArticleVersion>(`/content/article-versions/${id}/set-default/`, {});
  },

  /**
   * Delete a version.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/article-versions/${id}/`);
  },
};

// =============================================================================
// Article Localizations API
// =============================================================================

export const articleLocalizationsAPI = {
  /**
   * List localizations for an article.
   */
  list: async (articleId: string, params?: {
    locale?: string;
    status?: ArticleStatus;
    page?: number;
    page_size?: number;
  }): Promise<ArticleLocalizationListResponse> => {
    return v2Fetch<ArticleLocalizationListResponse>('/content/article-localizations/', { params: { ...params, article: articleId } });
  },

  /**
   * Get a single localization by ID.
   */
  get: async (id: string): Promise<ArticleLocalization> => {
    return v2Fetch<ArticleLocalization>(`/content/article-localizations/${id}/`);
  },

  /**
   * Create a new localization.
   */
  create: async (data: CreateArticleLocalizationPayload): Promise<ArticleLocalization> => {
    return v2Post<ArticleLocalization>('/content/article-localizations/', data);
  },

  /**
   * Update an existing localization.
   */
  update: async (id: string, data: UpdateArticleLocalizationPayload): Promise<ArticleLocalization> => {
    return v2Patch<ArticleLocalization>(`/content/article-localizations/${id}/`, data);
  },

  /**
   * Delete a localization.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/article-localizations/${id}/`);
  },

  /**
   * Translate an article to a locale using AI.
   */
  aiTranslate: async (articleId: string, locale: string): Promise<ArticleLocalization> => {
    return v2Post<ArticleLocalization>('/content/article-localizations/ai-translate/', { article: articleId, locale });
  },
};

// =============================================================================
// Article Relationships API
// =============================================================================

export const articleRelationshipsAPI = {
  /**
   * List relationships for an article.
   */
  list: async (params?: {
    source_article?: string;
    target_article?: string;
    status?: RelationshipStatus;
    page?: number;
    page_size?: number;
  }): Promise<ArticleRelationshipListResponse> => {
    return v2Fetch<ArticleRelationshipListResponse>('/content/article-relationships/', { params });
  },

  /**
   * Get a single relationship by ID.
   */
  get: async (id: string): Promise<ArticleRelationship> => {
    return v2Fetch<ArticleRelationship>(`/content/article-relationships/${id}/`);
  },

  /**
   * Create a new relationship.
   */
  create: async (data: CreateArticleRelationshipPayload): Promise<ArticleRelationship> => {
    return v2Post<ArticleRelationship>('/content/article-relationships/', data);
  },

  /**
   * Update an existing relationship.
   */
  update: async (id: string, data: UpdateArticleRelationshipPayload): Promise<ArticleRelationship> => {
    return v2Patch<ArticleRelationship>(`/content/article-relationships/${id}/`, data);
  },

  /**
   * Delete a relationship.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/article-relationships/${id}/`);
  },

  /**
   * Approve a suggested relationship.
   */
  approve: async (id: string): Promise<ArticleRelationship> => {
    return v2Post<ArticleRelationship>(`/content/article-relationships/${id}/approve/`, {});
  },

  /**
   * Reject a suggested relationship.
   */
  reject: async (id: string): Promise<ArticleRelationship> => {
    return v2Post<ArticleRelationship>(`/content/article-relationships/${id}/reject/`, {});
  },
};

// =============================================================================
// Article Feedback API
// =============================================================================

export const articleFeedbackAPI = {
  /**
   * List feedback for an article.
   */
  list: async (params?: {
    object_id?: string;
    status?: FeedbackStatus;
    severity?: string;
    page?: number;
    page_size?: number;
  }): Promise<ArticleFeedbackListResponse> => {
    return v2Fetch<ArticleFeedbackListResponse>('/content/article-feedback/', { params });
  },

  /**
   * Get a single feedback by ID.
   */
  get: async (id: string): Promise<ArticleFeedback> => {
    return v2Fetch<ArticleFeedback>(`/content/article-feedback/${id}/`);
  },

  /**
   * Create new feedback.
   */
  create: async (data: CreateArticleFeedbackPayload): Promise<ArticleFeedback> => {
    return v2Post<ArticleFeedback>('/content/article-feedback/', data);
  },

  /**
   * Update existing feedback.
   */
  update: async (id: string, data: UpdateArticleFeedbackPayload): Promise<ArticleFeedback> => {
    return v2Patch<ArticleFeedback>(`/content/article-feedback/${id}/`, data);
  },

  /**
   * Delete feedback.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/article-feedback/${id}/`);
  },

  /**
   * Mark feedback as addressed.
   */
  markAddressed: async (id: string, notes?: string): Promise<ArticleFeedback> => {
    return v2Post<ArticleFeedback>(`/content/article-feedback/${id}/mark-addressed/`, { notes });
  },

  /**
   * Dismiss feedback.
   */
  dismiss: async (id: string, notes?: string): Promise<ArticleFeedback> => {
    return v2Post<ArticleFeedback>(`/content/article-feedback/${id}/dismiss/`, { notes });
  },
};

// =============================================================================
// Personas API
// =============================================================================

export const personasAPI = {
  /**
   * List all personas for the organization.
   */
  list: async (params?: {
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PersonaListResponse> => {
    return v2Fetch<PersonaListResponse>('/content/personas/', { params });
  },

  /**
   * Get a single persona by ID.
   */
  get: async (id: string): Promise<Persona> => {
    return v2Fetch<Persona>(`/content/personas/${id}/`);
  },

  /**
   * Create a new persona.
   */
  create: async (data: CreatePersonaPayload): Promise<Persona> => {
    return v2Post<Persona>('/content/personas/', data);
  },

  /**
   * Update an existing persona.
   */
  update: async (id: string, data: UpdatePersonaPayload): Promise<Persona> => {
    return v2Patch<Persona>(`/content/personas/${id}/`, data);
  },

  /**
   * Delete a persona.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/personas/${id}/`);
  },

  /**
   * Set a persona as default.
   */
  setDefault: async (id: string): Promise<Persona> => {
    return v2Post<Persona>(`/content/personas/${id}/set-default/`, {});
  },
};

// =============================================================================
// Tutorials API
// =============================================================================

export const tutorialsAPI = {
  /**
   * List all tutorials for the organization.
   */
  list: async (params?: {
    is_published?: boolean;
    difficulty?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<TutorialListResponse> => {
    return v2Fetch<TutorialListResponse>('/content/tutorials/', { params });
  },

  /**
   * Get a single tutorial by ID.
   */
  get: async (id: string): Promise<Tutorial> => {
    return v2Fetch<Tutorial>(`/content/tutorials/${id}/`);
  },

  /**
   * Create a new tutorial.
   */
  create: async (data: CreateTutorialPayload): Promise<Tutorial> => {
    return v2Post<Tutorial>('/content/tutorials/', data);
  },

  /**
   * Update an existing tutorial.
   */
  update: async (id: string, data: UpdateTutorialPayload): Promise<Tutorial> => {
    return v2Patch<Tutorial>(`/content/tutorials/${id}/`, data);
  },

  /**
   * Delete a tutorial.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/tutorials/${id}/`);
  },

  /**
   * Publish a tutorial.
   */
  publish: async (id: string): Promise<Tutorial> => {
    return v2Post<Tutorial>(`/content/tutorials/${id}/publish/`, {});
  },

  /**
   * Unpublish a tutorial.
   */
  unpublish: async (id: string): Promise<Tutorial> => {
    return v2Post<Tutorial>(`/content/tutorials/${id}/unpublish/`, {});
  },
};

// =============================================================================
// Tutorial Steps API
// =============================================================================

export const tutorialStepsAPI = {
  /**
   * List steps for a tutorial.
   */
  list: async (tutorialId: string, params?: {
    page?: number;
    page_size?: number;
  }): Promise<TutorialStepListResponse> => {
    return v2Fetch<TutorialStepListResponse>('/content/tutorial-steps/', { params: { ...params, tutorial: tutorialId } });
  },

  /**
   * Get a single step by ID.
   */
  get: async (id: string): Promise<TutorialStep> => {
    return v2Fetch<TutorialStep>(`/content/tutorial-steps/${id}/`);
  },

  /**
   * Create a new step.
   */
  create: async (data: CreateTutorialStepPayload): Promise<TutorialStep> => {
    return v2Post<TutorialStep>('/content/tutorial-steps/', data);
  },

  /**
   * Update an existing step.
   */
  update: async (id: string, data: UpdateTutorialStepPayload): Promise<TutorialStep> => {
    return v2Patch<TutorialStep>(`/content/tutorial-steps/${id}/`, data);
  },

  /**
   * Delete a step.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/content/tutorial-steps/${id}/`);
  },

  /**
   * Reorder steps.
   */
  reorder: async (tutorialId: string, stepIds: string[]): Promise<void> => {
    return v2Post<void>('/content/tutorial-steps/reorder/', { tutorial: tutorialId, step_ids: stepIds });
  },
};
