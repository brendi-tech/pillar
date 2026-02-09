/**
 * TanStack Query configurations for Task Suggestions API.
 *
 * Includes queries and mutations for AI-generated task suggestions.
 */
import { queryOptions } from '@tanstack/react-query';
import { taskSuggestionsAPI, type TaskSuggestionListParams } from '@/lib/admin/task-suggestions-api';
import type { TaskSuggestionTriggerRequest, TaskSuggestionApplyRequest } from '@/types/tasks';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const taskSuggestionKeys = {
  all: ['task-suggestion'] as const,

  // Lists
  lists: () => [...taskSuggestionKeys.all, 'list'] as const,
  list: (params?: TaskSuggestionListParams) => [...taskSuggestionKeys.lists(), params] as const,
};

// =============================================================================
// Query Options - Task Suggestions
// =============================================================================

/**
 * List task suggestions (defaults to pending)
 */
export const taskSuggestionListQuery = (params?: TaskSuggestionListParams) =>
  queryOptions({
    queryKey: taskSuggestionKeys.list(params),
    queryFn: () => taskSuggestionsAPI.list(params),
  });

// =============================================================================
// Mutations - Task Suggestions
// =============================================================================

/**
 * Trigger the task suggestion workflow
 */
export const triggerTaskSuggestionMutation = () => ({
  mutationFn: (data: TaskSuggestionTriggerRequest) => taskSuggestionsAPI.trigger(data),
});

/**
 * Apply a task suggestion to create an ActionTask
 */
export const applyTaskSuggestionMutation = () => ({
  mutationFn: ({
    suggestionId,
    data,
  }: {
    suggestionId: string;
    data?: TaskSuggestionApplyRequest;
  }) => taskSuggestionsAPI.apply(suggestionId, data),
});

/**
 * Dismiss a task suggestion
 */
export const dismissTaskSuggestionMutation = () => ({
  mutationFn: ({
    suggestionId,
    reason,
  }: {
    suggestionId: string;
    reason?: string;
  }) => taskSuggestionsAPI.dismiss(suggestionId, reason),
});

