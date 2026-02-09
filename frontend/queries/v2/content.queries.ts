/**
 * TanStack Query configurations for V2 Content API.
 *
 * Includes queries and mutations for:
 * - Article
 * - Category
 * - ArticleVersion
 * - ArticleLocalization
 * - ArticleRelationship
 * - ArticleFeedback
 * - Persona
 * - Tutorial
 * - TutorialStep
 */

import { queryOptions } from '@tanstack/react-query';
import {
  articlesAPI,
  categoriesAPI,
  articleVersionsAPI,
  articleLocalizationsAPI,
  articleRelationshipsAPI,
  articleFeedbackAPI,
  personasAPI,
  tutorialsAPI,
  tutorialStepsAPI,
} from '@/lib/admin/v2/content-api';
import type {
  ArticleStatus,
  CreateArticlePayload,
  UpdateArticlePayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateArticleVersionPayload,
  CreateArticleLocalizationPayload,
  UpdateArticleLocalizationPayload,
  CreateArticleRelationshipPayload,
  UpdateArticleRelationshipPayload,
  RelationshipStatus,
  CreateArticleFeedbackPayload,
  UpdateArticleFeedbackPayload,
  FeedbackStatus,
  CreatePersonaPayload,
  UpdatePersonaPayload,
  CreateTutorialPayload,
  UpdateTutorialPayload,
  CreateTutorialStepPayload,
  UpdateTutorialStepPayload,
} from '@/types/v2/content';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const contentKeys = {
  all: ['v2', 'content'] as const,

  // Articles
  articles: () => [...contentKeys.all, 'articles'] as const,
  articleList: (params?: { category?: string; status?: ArticleStatus | 'all'; is_internal?: boolean; search?: string }) =>
    [...contentKeys.articles(), 'list', params] as const,
  articleDetail: (id: string) => [...contentKeys.articles(), 'detail', id] as const,
  articleStats: (id: string) => [...contentKeys.articleDetail(id), 'stats'] as const,

  // Categories
  categories: () => [...contentKeys.all, 'categories'] as const,
  categoryList: (params?: { parent?: string; is_visible?: boolean; search?: string }) =>
    [...contentKeys.categories(), 'list', params] as const,
  categoryDetail: (id: string) => [...contentKeys.categories(), 'detail', id] as const,
  categoryTree: () => [...contentKeys.categories(), 'tree'] as const,

  // Article Versions
  articleVersions: (articleId: string) => [...contentKeys.articleDetail(articleId), 'versions'] as const,
  articleVersionDetail: (id: string) => [...contentKeys.all, 'article-versions', 'detail', id] as const,

  // Article Localizations
  articleLocalizations: (articleId: string) => [...contentKeys.articleDetail(articleId), 'localizations'] as const,
  articleLocalizationDetail: (id: string) => [...contentKeys.all, 'article-localizations', 'detail', id] as const,

  // Article Relationships
  articleRelationships: () => [...contentKeys.all, 'article-relationships'] as const,
  articleRelationshipList: (params?: { source_article?: string; target_article?: string; status?: RelationshipStatus }) =>
    [...contentKeys.articleRelationships(), 'list', params] as const,
  articleRelationshipDetail: (id: string) => [...contentKeys.articleRelationships(), 'detail', id] as const,

  // Article Feedback
  articleFeedback: () => [...contentKeys.all, 'article-feedback'] as const,
  articleFeedbackList: (params?: { object_id?: string; status?: FeedbackStatus; severity?: string }) =>
    [...contentKeys.articleFeedback(), 'list', params] as const,
  articleFeedbackDetail: (id: string) => [...contentKeys.articleFeedback(), 'detail', id] as const,

  // Personas
  personas: () => [...contentKeys.all, 'personas'] as const,
  personaList: (params?: { is_active?: boolean; search?: string }) =>
    [...contentKeys.personas(), 'list', params] as const,
  personaDetail: (id: string) => [...contentKeys.personas(), 'detail', id] as const,

  // Tutorials
  tutorials: () => [...contentKeys.all, 'tutorials'] as const,
  tutorialList: (params?: { is_published?: boolean; difficulty?: string; search?: string }) =>
    [...contentKeys.tutorials(), 'list', params] as const,
  tutorialDetail: (id: string) => [...contentKeys.tutorials(), 'detail', id] as const,

  // Tutorial Steps
  tutorialSteps: (tutorialId: string) => [...contentKeys.tutorialDetail(tutorialId), 'steps'] as const,
  tutorialStepDetail: (id: string) => [...contentKeys.all, 'tutorial-steps', 'detail', id] as const,
};

// =============================================================================
// Article Queries
// =============================================================================

/**
 * List all articles for the product.
 */
export const articleListQuery = (params?: {
  category?: string;
  status?: ArticleStatus | 'all';
  is_internal?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.articleList(params),
    queryFn: () => articlesAPI.list(params),
  });

/**
 * Get a single article by ID.
 */
export const articleDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleDetail(id),
    queryFn: () => articlesAPI.get(id),
    enabled: !!id,
  });

/**
 * Get article stats.
 */
export const articleStatsQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleStats(id),
    queryFn: () => articlesAPI.getStats(id),
    enabled: !!id,
  });

// =============================================================================
// Article Mutations
// =============================================================================

export const createArticleMutation = () => ({
  mutationFn: (data: CreateArticlePayload) => articlesAPI.create(data),
});

export const updateArticleMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateArticlePayload }) =>
    articlesAPI.update(id, data),
});

export const deleteArticleMutation = () => ({
  mutationFn: (id: string) => articlesAPI.delete(id),
});

export const publishArticleMutation = () => ({
  mutationFn: (id: string) => articlesAPI.publish(id),
});

export const archiveArticleMutation = () => ({
  mutationFn: (id: string) => articlesAPI.archive(id),
});

export const bulkPublishArticlesMutation = () => ({
  mutationFn: (articleIds: string[]) => articlesAPI.bulkPublish(articleIds),
});

export const bulkArchiveArticlesMutation = () => ({
  mutationFn: (articleIds: string[]) => articlesAPI.bulkArchive(articleIds),
});

// =============================================================================
// Category Queries
// =============================================================================

/**
 * List all categories for the product.
 */
export const categoryListQuery = (params?: {
  parent?: string;
  is_visible?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.categoryList(params),
    queryFn: () => categoriesAPI.list(params),
  });

/**
 * Get a single category by ID.
 */
export const categoryDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.categoryDetail(id),
    queryFn: () => categoriesAPI.get(id),
    enabled: !!id,
  });

/**
 * Get category tree (hierarchical structure).
 */
export const categoryTreeQuery = () =>
  queryOptions({
    queryKey: contentKeys.categoryTree(),
    queryFn: () => categoriesAPI.getTree(),
  });

// =============================================================================
// Category Mutations
// =============================================================================

export const createCategoryMutation = () => ({
  mutationFn: (data: CreateCategoryPayload) => categoriesAPI.create(data),
});

export const updateCategoryMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateCategoryPayload }) =>
    categoriesAPI.update(id, data),
});

export const deleteCategoryMutation = () => ({
  mutationFn: (id: string) => categoriesAPI.delete(id),
});

export const reorderCategoriesMutation = () => ({
  mutationFn: (categoryIds: string[]) => categoriesAPI.reorder(categoryIds),
});

// =============================================================================
// Article Version Queries
// =============================================================================

/**
 * List versions for an article.
 */
export const articleVersionListQuery = (articleId: string, params?: { page?: number; page_size?: number }) =>
  queryOptions({
    queryKey: contentKeys.articleVersions(articleId),
    queryFn: () => articleVersionsAPI.list(articleId, params),
    enabled: !!articleId,
  });

/**
 * Get a single version by ID.
 */
export const articleVersionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleVersionDetail(id),
    queryFn: () => articleVersionsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Article Version Mutations
// =============================================================================

export const createArticleVersionMutation = () => ({
  mutationFn: (data: CreateArticleVersionPayload) => articleVersionsAPI.create(data),
});

export const setDefaultArticleVersionMutation = () => ({
  mutationFn: (id: string) => articleVersionsAPI.setDefault(id),
});

export const deleteArticleVersionMutation = () => ({
  mutationFn: (id: string) => articleVersionsAPI.delete(id),
});

// =============================================================================
// Article Localization Queries
// =============================================================================

/**
 * List localizations for an article.
 */
export const articleLocalizationListQuery = (articleId: string, params?: { locale?: string; status?: ArticleStatus }) =>
  queryOptions({
    queryKey: contentKeys.articleLocalizations(articleId),
    queryFn: () => articleLocalizationsAPI.list(articleId, params),
    enabled: !!articleId,
  });

/**
 * Get a single localization by ID.
 */
export const articleLocalizationDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleLocalizationDetail(id),
    queryFn: () => articleLocalizationsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Article Localization Mutations
// =============================================================================

export const createArticleLocalizationMutation = () => ({
  mutationFn: (data: CreateArticleLocalizationPayload) => articleLocalizationsAPI.create(data),
});

export const updateArticleLocalizationMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateArticleLocalizationPayload }) =>
    articleLocalizationsAPI.update(id, data),
});

export const deleteArticleLocalizationMutation = () => ({
  mutationFn: (id: string) => articleLocalizationsAPI.delete(id),
});

export const aiTranslateArticleMutation = () => ({
  mutationFn: ({ articleId, locale }: { articleId: string; locale: string }) =>
    articleLocalizationsAPI.aiTranslate(articleId, locale),
});

// =============================================================================
// Article Relationship Queries
// =============================================================================

/**
 * List article relationships.
 */
export const articleRelationshipListQuery = (params?: {
  source_article?: string;
  target_article?: string;
  status?: RelationshipStatus;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.articleRelationshipList(params),
    queryFn: () => articleRelationshipsAPI.list(params),
  });

/**
 * Get a single relationship by ID.
 */
export const articleRelationshipDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleRelationshipDetail(id),
    queryFn: () => articleRelationshipsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Article Relationship Mutations
// =============================================================================

export const createArticleRelationshipMutation = () => ({
  mutationFn: (data: CreateArticleRelationshipPayload) => articleRelationshipsAPI.create(data),
});

export const updateArticleRelationshipMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateArticleRelationshipPayload }) =>
    articleRelationshipsAPI.update(id, data),
});

export const deleteArticleRelationshipMutation = () => ({
  mutationFn: (id: string) => articleRelationshipsAPI.delete(id),
});

export const approveArticleRelationshipMutation = () => ({
  mutationFn: (id: string) => articleRelationshipsAPI.approve(id),
});

export const rejectArticleRelationshipMutation = () => ({
  mutationFn: (id: string) => articleRelationshipsAPI.reject(id),
});

// =============================================================================
// Article Feedback Queries
// =============================================================================

/**
 * List article feedback.
 */
export const articleFeedbackListQuery = (params?: {
  object_id?: string;
  status?: FeedbackStatus;
  severity?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.articleFeedbackList(params),
    queryFn: () => articleFeedbackAPI.list(params),
  });

/**
 * Get a single feedback by ID.
 */
export const articleFeedbackDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.articleFeedbackDetail(id),
    queryFn: () => articleFeedbackAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Article Feedback Mutations
// =============================================================================

export const createArticleFeedbackMutation = () => ({
  mutationFn: (data: CreateArticleFeedbackPayload) => articleFeedbackAPI.create(data),
});

export const updateArticleFeedbackMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateArticleFeedbackPayload }) =>
    articleFeedbackAPI.update(id, data),
});

export const deleteArticleFeedbackMutation = () => ({
  mutationFn: (id: string) => articleFeedbackAPI.delete(id),
});

export const markFeedbackAddressedMutation = () => ({
  mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
    articleFeedbackAPI.markAddressed(id, notes),
});

export const dismissFeedbackMutation = () => ({
  mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
    articleFeedbackAPI.dismiss(id, notes),
});

// =============================================================================
// Persona Queries
// =============================================================================

/**
 * List all personas for the organization.
 */
export const personaListQuery = (params?: {
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.personaList(params),
    queryFn: () => personasAPI.list(params),
  });

/**
 * Get a single persona by ID.
 */
export const personaDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.personaDetail(id),
    queryFn: () => personasAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Persona Mutations
// =============================================================================

export const createPersonaMutation = () => ({
  mutationFn: (data: CreatePersonaPayload) => personasAPI.create(data),
});

export const updatePersonaMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdatePersonaPayload }) =>
    personasAPI.update(id, data),
});

export const deletePersonaMutation = () => ({
  mutationFn: (id: string) => personasAPI.delete(id),
});

export const setDefaultPersonaMutation = () => ({
  mutationFn: (id: string) => personasAPI.setDefault(id),
});

// =============================================================================
// Tutorial Queries
// =============================================================================

/**
 * List all tutorials for the organization.
 */
export const tutorialListQuery = (params?: {
  is_published?: boolean;
  difficulty?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: contentKeys.tutorialList(params),
    queryFn: () => tutorialsAPI.list(params),
  });

/**
 * Get a single tutorial by ID.
 */
export const tutorialDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.tutorialDetail(id),
    queryFn: () => tutorialsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Tutorial Mutations
// =============================================================================

export const createTutorialMutation = () => ({
  mutationFn: (data: CreateTutorialPayload) => tutorialsAPI.create(data),
});

export const updateTutorialMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateTutorialPayload }) =>
    tutorialsAPI.update(id, data),
});

export const deleteTutorialMutation = () => ({
  mutationFn: (id: string) => tutorialsAPI.delete(id),
});

export const publishTutorialMutation = () => ({
  mutationFn: (id: string) => tutorialsAPI.publish(id),
});

export const unpublishTutorialMutation = () => ({
  mutationFn: (id: string) => tutorialsAPI.unpublish(id),
});

// =============================================================================
// Tutorial Step Queries
// =============================================================================

/**
 * List steps for a tutorial.
 */
export const tutorialStepListQuery = (tutorialId: string, params?: { page?: number; page_size?: number }) =>
  queryOptions({
    queryKey: contentKeys.tutorialSteps(tutorialId),
    queryFn: () => tutorialStepsAPI.list(tutorialId, params),
    enabled: !!tutorialId,
  });

/**
 * Get a single step by ID.
 */
export const tutorialStepDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contentKeys.tutorialStepDetail(id),
    queryFn: () => tutorialStepsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Tutorial Step Mutations
// =============================================================================

export const createTutorialStepMutation = () => ({
  mutationFn: (data: CreateTutorialStepPayload) => tutorialStepsAPI.create(data),
});

export const updateTutorialStepMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateTutorialStepPayload }) =>
    tutorialStepsAPI.update(id, data),
});

export const deleteTutorialStepMutation = () => ({
  mutationFn: (id: string) => tutorialStepsAPI.delete(id),
});

export const reorderTutorialStepsMutation = () => ({
  mutationFn: ({ tutorialId, stepIds }: { tutorialId: string; stepIds: string[] }) =>
    tutorialStepsAPI.reorder(tutorialId, stepIds),
});
