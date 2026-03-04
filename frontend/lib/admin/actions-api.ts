/**
 * Actions API module for Help Center admin dashboard.
 *
 * Provides CRUD operations for Actions - publishable actions
 * that the AI assistant can suggest to users.
 */
import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';
import type {
  Action,
  ActionTemplate,
  ActionCreateRequest,
  ActionUpdateRequest,
  ActionListResponse,
  ActionStatsResponse,
  ExecutionStatsResponse,
  ActionStatus,
  ActionType,
  ActionGenerationSuggestion,
} from '@/types/actions';

// ============================================================================
// API Types
// ============================================================================

/**
 * Parameters for listing actions.
 */
export interface ActionListParams {
  status?: ActionStatus;
  action_type?: ActionType;
  search?: string;
  product?: string;  // Renamed from help_center_config
  ordering?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Actions API - Now at /api/admin/products/actions/
// ============================================================================

export const actionsAPI = {
  /**
   * List all actions for the organization.
   */
  list: async (params?: ActionListParams): Promise<ActionListResponse> => {
    const queryParams = new URLSearchParams();

    if (params?.status) queryParams.set('status', params.status);
    if (params?.action_type) queryParams.set('action_type', params.action_type);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.product) queryParams.set('product', params.product);
    if (params?.ordering) queryParams.set('ordering', params.ordering);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.page_size) queryParams.set('page_size', String(params.page_size));

    const query = queryParams.toString();
    const url = query ? `/products/actions/?${query}` : '/products/actions/';

    return adminFetch<ActionListResponse>(url);
  },

  /**
   * Get a single action by ID.
   */
  get: async (id: string): Promise<Action> => {
    return adminFetch<Action>(`/products/actions/${id}/`);
  },

  /**
   * Create a new action.
   */
  create: async (data: ActionCreateRequest): Promise<Action> => {
    return adminPost<Action>('/products/actions/', data);
  },

  /**
   * Update an existing action.
   */
  update: async (id: string, data: ActionUpdateRequest): Promise<Action> => {
    return adminPatch<Action>(`/products/actions/${id}/`, data);
  },

  /**
   * Delete an action.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete(`/products/actions/${id}/`);
  },

  /**
   * Publish an action (make it available for AI suggestions).
   */
  publish: async (id: string): Promise<Action> => {
    return adminPost<Action>(`/products/actions/${id}/publish/`, {});
  },

  /**
   * Archive an action (remove from AI suggestions).
   */
  archive: async (id: string): Promise<Action> => {
    return adminPost<Action>(`/products/actions/${id}/archive/`, {});
  },

  /**
   * Restore an archived action (set back to draft).
   */
  restore: async (id: string): Promise<Action> => {
    return adminPatch<Action>(`/products/actions/${id}/`, { status: 'draft' });
  },

  /**
   * Get pre-built action templates.
   */
  getTemplates: async (): Promise<ActionTemplate[]> => {
    return adminFetch<ActionTemplate[]>('/products/actions/templates/');
  },

  /**
   * Record that an action was executed.
   */
  recordExecution: async (id: string): Promise<{ execution_count: number; last_executed_at: string | null }> => {
    return adminPost<{ execution_count: number; last_executed_at: string | null }>(
      `/products/actions/${id}/record-execution/`,
      {}
    );
  },

  /**
   * Get execution stats for an action.
   */
  getStats: async (id: string): Promise<ActionStatsResponse> => {
    return adminFetch<ActionStatsResponse>(`/products/actions/${id}/stats/`);
  },

  /**
   * Get aggregated execution statistics from ActionExecutionLog.
   */
  getExecutionStats: async (id: string): Promise<ExecutionStatsResponse> => {
    return adminFetch<ExecutionStatsResponse>(`/products/actions/${id}/execution-stats/`);
  },

  /**
   * Generate action configuration from a natural language description using AI.
   * 
   * @param description - Natural language description of what the action should do
   * @returns Suggested action configuration (identifier, action_type, etc.)
   */
  generateSuggestion: async (description: string): Promise<ActionGenerationSuggestion> => {
    return adminPost<ActionGenerationSuggestion>('/products/actions/generate-suggestion/', { description });
  },
};
