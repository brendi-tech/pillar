/**
 * Action Suggestions API module for Help Center admin dashboard.
 *
 * Provides endpoints for AI-generated action suggestions:
 * - Triggering content analysis workflow
 * - Listing pending suggestions
 * - Applying/dismissing suggestions
 */
import { adminFetch, adminPost } from './api-client';
import type {
  Action,
  ActionSuggestion,
  ActionSuggestionsResponse,
  ActionSuggestionTriggerRequest,
  ActionSuggestionTriggerResponse,
  ActionSuggestionApplyRequest,
} from '@/types/actions';

// ============================================================================
// API Types
// ============================================================================

/**
 * Parameters for listing action suggestions.
 */
export interface ActionSuggestionListParams {
  help_center_config?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'all';
}

// ============================================================================
// Action Suggestions API
// ============================================================================

export const actionSuggestionsAPI = {
  /**
   * Trigger the action suggestion workflow to analyze help center content.
   */
  trigger: async (data: ActionSuggestionTriggerRequest): Promise<ActionSuggestionTriggerResponse> => {
    return adminPost<ActionSuggestionTriggerResponse>('/actions/suggest/', data);
  },

  /**
   * List action suggestions.
   * Defaults to pending suggestions unless status is specified.
   */
  list: async (params?: ActionSuggestionListParams): Promise<ActionSuggestionsResponse> => {
    const queryParams = new URLSearchParams();

    if (params?.help_center_config) {
      queryParams.set('help_center_config', params.help_center_config);
    }
    if (params?.status) {
      queryParams.set('status', params.status);
    }

    const query = queryParams.toString();
    const url = query ? `/actions/suggestions/?${query}` : '/actions/suggestions/';

    return adminFetch<ActionSuggestionsResponse>(url);
  },

  /**
   * Apply an action suggestion to create an Action.
   * Optionally provide overrides to modify action fields.
   */
  apply: async (suggestionId: string, data?: ActionSuggestionApplyRequest): Promise<Action> => {
    return adminPost<Action>(`/actions/suggestions/${suggestionId}/apply/`, data ?? {});
  },

  /**
   * Dismiss an action suggestion.
   * Optionally provide a reason for dismissal.
   */
  dismiss: async (suggestionId: string, reason?: string): Promise<{ status: string; suggestion_id: string }> => {
    return adminPost<{ status: string; suggestion_id: string }>(
      `/actions/suggestions/${suggestionId}/dismiss/`,
      reason ? { reason } : {}
    );
  },
};
