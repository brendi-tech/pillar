/**
 * TanStack Query configurations for AI Assistant API.
 *
 * Note: This API is mutation-heavy as all operations are POST requests
 * that trigger AI processing.
 */

import {
    analyzeContent,
    applySuggestionAction,
    expandContent,
    generateSEO,
    improveContent,
    simplifyContent,
    suggestCategory,
    suggestTags,
} from "@/lib/admin/assistant-api";
import type { AssistantContentType } from "@/types/admin";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const assistantKeys = {
  all: ["assistant"] as const,

  // Analysis results (could be cached after initial analysis)
  analysis: () => [...assistantKeys.all, "analysis"] as const,
  contentAnalysis: (contentType: AssistantContentType, contentId: string) =>
    [...assistantKeys.analysis(), contentType, contentId] as const,
};

// =============================================================================
// Mutations
// =============================================================================

/**
 * Analyze content and return AI suggestions
 */
export const analyzeContentMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
  }: {
    contentType: AssistantContentType;
    contentId: string;
  }) => analyzeContent(contentType, contentId),
});

/**
 * Generate SEO metadata (meta title, description, slug)
 */
export const generateSEOMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    content,
    title,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    content: string;
    title: string;
  }) => generateSEO(contentType, contentId, content, title),
});

/**
 * Get tag suggestions based on content
 */
export const suggestTagsMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    content,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    content: string;
  }) => suggestTags(contentType, contentId, content),
});

/**
 * Get category suggestion for an article
 */
export const suggestCategoryMutation = () => ({
  mutationFn: ({
    articleId,
    content,
    title,
  }: {
    articleId: string;
    content: string;
    title: string;
  }) => suggestCategory(articleId, content, title),
});

/**
 * Improve content writing (clarity, grammar, flow)
 */
export const improveContentMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    content,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    content: string;
  }) => improveContent(contentType, contentId, content),
});

/**
 * Simplify content for accessibility
 */
export const simplifyContentMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    content,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    content: string;
  }) => simplifyContent(contentType, contentId, content),
});

/**
 * Expand content with more detail
 */
export const expandContentMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    content,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    content: string;
  }) => expandContent(contentType, contentId, content),
});

/**
 * Apply a suggestion action
 */
export const applySuggestionActionMutation = () => ({
  mutationFn: ({
    contentType,
    contentId,
    suggestionId,
    actionId,
    data,
  }: {
    contentType: AssistantContentType;
    contentId: string;
    suggestionId: string;
    actionId: string;
    data?: Record<string, unknown>;
  }) =>
    applySuggestionAction(contentType, contentId, suggestionId, actionId, data),
});
