/**
 * Task Suggestions API module for Help Center admin dashboard.
 *
 * Provides endpoints for AI-generated task suggestions:
 * - Triggering content analysis workflow
 * - Listing pending suggestions
 * - Applying/dismissing suggestions
 */
import { adminFetch, adminPost } from './api-client';
import type {
  Task,
  TaskSuggestion,
  TaskSuggestionsResponse,
  TaskSuggestionTriggerRequest,
  TaskSuggestionTriggerResponse,
  TaskSuggestionApplyRequest,
} from '@/types/tasks';

// ============================================================================
// API Types
// ============================================================================

/**
 * Parameters for listing task suggestions.
 */
export interface TaskSuggestionListParams {
  help_center_config?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'all';
}

// ============================================================================
// Task Suggestions API
// ============================================================================

export const taskSuggestionsAPI = {
  /**
   * Trigger the task suggestion workflow to analyze help center content.
   */
  trigger: async (data: TaskSuggestionTriggerRequest): Promise<TaskSuggestionTriggerResponse> => {
    return adminPost<TaskSuggestionTriggerResponse>('/tasks/suggest/', data);
  },

  /**
   * List task suggestions.
   * Defaults to pending suggestions unless status is specified.
   */
  list: async (params?: TaskSuggestionListParams): Promise<TaskSuggestionsResponse> => {
    const queryParams = new URLSearchParams();

    if (params?.help_center_config) {
      queryParams.set('help_center_config', params.help_center_config);
    }
    if (params?.status) {
      queryParams.set('status', params.status);
    }

    const query = queryParams.toString();
    const url = query ? `/tasks/suggestions/?${query}` : '/tasks/suggestions/';

    return adminFetch<TaskSuggestionsResponse>(url);
  },

  /**
   * Apply a task suggestion to create an ActionTask.
   * Optionally provide overrides to modify task fields.
   */
  apply: async (suggestionId: string, data?: TaskSuggestionApplyRequest): Promise<Task> => {
    return adminPost<Task>(`/tasks/suggestions/${suggestionId}/apply/`, data ?? {});
  },

  /**
   * Dismiss a task suggestion.
   * Optionally provide a reason for dismissal.
   */
  dismiss: async (suggestionId: string, reason?: string): Promise<{ status: string; suggestion_id: string }> => {
    return adminPost<{ status: string; suggestion_id: string }>(
      `/tasks/suggestions/${suggestionId}/dismiss/`,
      reason ? { reason } : {}
    );
  },
};

