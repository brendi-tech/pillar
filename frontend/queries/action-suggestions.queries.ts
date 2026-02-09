/**
 * TanStack Query configurations for Action Suggestions API.
 *
 * Includes queries and mutations for AI-generated action suggestions.
 */
import { queryOptions } from '@tanstack/react-query';
import { actionSuggestionsAPI, type ActionSuggestionListParams } from '@/lib/admin/action-suggestions-api';
import type { ActionSuggestionTriggerRequest, ActionSuggestionApplyRequest } from '@/types/actions';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const actionSuggestionKeys = {
  all: ['action-suggestion'] as const,

  // Lists
  lists: () => [...actionSuggestionKeys.all, 'list'] as const,
  list: (params?: ActionSuggestionListParams) => [...actionSuggestionKeys.lists(), params] as const,
};

// =============================================================================
// Query Options - Action Suggestions
// =============================================================================

/**
 * List action suggestions (defaults to pending)
 */
export const actionSuggestionListQuery = (params?: ActionSuggestionListParams) =>
  queryOptions({
    queryKey: actionSuggestionKeys.list(params),
    queryFn: () => actionSuggestionsAPI.list(params),
  });

// =============================================================================
// Mutations - Action Suggestions
// =============================================================================

/**
 * Trigger the action suggestion workflow
 */
export const triggerActionSuggestionMutation = () => ({
  mutationFn: (data: ActionSuggestionTriggerRequest) => actionSuggestionsAPI.trigger(data),
});

/**
 * Apply an action suggestion to create an Action
 */
export const applyActionSuggestionMutation = () => ({
  mutationFn: ({
    suggestionId,
    data,
  }: {
    suggestionId: string;
    data?: ActionSuggestionApplyRequest;
  }) => actionSuggestionsAPI.apply(suggestionId, data),
});

/**
 * Dismiss an action suggestion
 */
export const dismissActionSuggestionMutation = () => ({
  mutationFn: ({
    suggestionId,
    reason,
  }: {
    suggestionId: string;
    reason?: string;
  }) => actionSuggestionsAPI.dismiss(suggestionId, reason),
});
