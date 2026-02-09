/**
 * AI Assistant API Client
 *
 * Provides API functions for the AI Assistant Panel features including:
 * - Content analysis and suggestions
 * - SEO generation
 * - Tag and category suggestions
 * - Content improvement (improve, simplify, expand)
 */

import { adminPost } from './api-client';
import type {
  AssistantContentType,
  AnalyzeContentResponse,
  SEOGenerationResult,
  TagSuggestionResult,
  CategorySuggestionResult,
  ContentImprovementResult,
  AssistantActionResponse,
} from '@/types/admin';

// =============================================================================
// API Functions
// =============================================================================

/**
 * Analyze content and return AI suggestions
 */
export async function analyzeContent(
  contentType: AssistantContentType,
  contentId: string
): Promise<AnalyzeContentResponse> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/analyze/`
      : `/categories/${contentId}/assistant/analyze/`;

  return adminPost<AnalyzeContentResponse>(endpoint, {});
}

/**
 * Generate SEO metadata (meta title, description, slug)
 */
export async function generateSEO(
  contentType: AssistantContentType,
  contentId: string,
  content: string,
  title: string
): Promise<AssistantActionResponse<SEOGenerationResult>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/generate-seo/`
      : `/categories/${contentId}/assistant/generate-seo/`;

  return adminPost<AssistantActionResponse<SEOGenerationResult>>(endpoint, {
    content,
    title,
  });
}

/**
 * Get tag suggestions based on content
 */
export async function suggestTags(
  contentType: AssistantContentType,
  contentId: string,
  content: string
): Promise<AssistantActionResponse<TagSuggestionResult>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/suggest-tags/`
      : `/categories/${contentId}/assistant/suggest-tags/`;

  return adminPost<AssistantActionResponse<TagSuggestionResult>>(endpoint, {
    content,
  });
}

/**
 * Get category suggestion for an article
 */
export async function suggestCategory(
  articleId: string,
  content: string,
  title: string
): Promise<AssistantActionResponse<CategorySuggestionResult>> {
  return adminPost<AssistantActionResponse<CategorySuggestionResult>>(
    `/articles/${articleId}/assistant/suggest-category/`,
    { content, title }
  );
}

/**
 * Improve content writing (clarity, grammar, flow)
 */
export async function improveContent(
  contentType: AssistantContentType,
  contentId: string,
  content: string
): Promise<AssistantActionResponse<ContentImprovementResult>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/improve-content/`
      : `/categories/${contentId}/assistant/improve-content/`;

  return adminPost<AssistantActionResponse<ContentImprovementResult>>(endpoint, {
    content,
    mode: 'improve',
  });
}

/**
 * Simplify content for accessibility
 */
export async function simplifyContent(
  contentType: AssistantContentType,
  contentId: string,
  content: string
): Promise<AssistantActionResponse<ContentImprovementResult>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/simplify-content/`
      : `/categories/${contentId}/assistant/simplify-content/`;

  return adminPost<AssistantActionResponse<ContentImprovementResult>>(endpoint, {
    content,
    mode: 'simplify',
  });
}

/**
 * Expand content with more detail
 */
export async function expandContent(
  contentType: AssistantContentType,
  contentId: string,
  content: string
): Promise<AssistantActionResponse<ContentImprovementResult>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/expand-content/`
      : `/categories/${contentId}/assistant/expand-content/`;

  return adminPost<AssistantActionResponse<ContentImprovementResult>>(endpoint, {
    content,
    mode: 'expand',
  });
}

/**
 * Apply a suggestion action
 */
export async function applySuggestionAction(
  contentType: AssistantContentType,
  contentId: string,
  suggestionId: string,
  actionId: string,
  data?: Record<string, unknown>
): Promise<AssistantActionResponse<void>> {
  const endpoint =
    contentType === 'article'
      ? `/articles/${contentId}/assistant/suggestions/${suggestionId}/${actionId}/`
      : `/categories/${contentId}/assistant/suggestions/${suggestionId}/${actionId}/`;

  return adminPost<AssistantActionResponse<void>>(endpoint, data ?? {});
}

// =============================================================================
// Convenience API Object
// =============================================================================

export const assistantAPI = {
  analyze: analyzeContent,
  generateSEO,
  suggestTags,
  suggestCategory,
  improveContent,
  simplifyContent,
  expandContent,
  applySuggestionAction,
};
