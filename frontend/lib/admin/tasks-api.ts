/**
 * Tasks API module for Help Center admin dashboard.
 *
 * Provides CRUD operations for ActionTasks - publishable actions
 * that the AI assistant can suggest to users.
 */
import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';
import type {
  Task,
  TaskTemplate,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskListResponse,
  TaskStatsResponse,
  TaskStatus,
  TaskType,
  TaskGenerationSuggestion,
} from '@/types/tasks';

// ============================================================================
// API Types
// ============================================================================

/**
 * Parameters for listing tasks.
 */
export interface TaskListParams {
  status?: TaskStatus;
  task_type?: TaskType;
  search?: string;
  help_center_config?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Tasks API
// ============================================================================

export const tasksAPI = {
  /**
   * List all tasks for the organization.
   */
  list: async (params?: TaskListParams): Promise<TaskListResponse> => {
    const queryParams = new URLSearchParams();

    if (params?.status) queryParams.set('status', params.status);
    if (params?.task_type) queryParams.set('task_type', params.task_type);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.help_center_config) queryParams.set('help_center_config', params.help_center_config);
    if (params?.ordering) queryParams.set('ordering', params.ordering);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.page_size) queryParams.set('page_size', String(params.page_size));

    const query = queryParams.toString();
    const url = query ? `/tasks/?${query}` : '/tasks/';

    return adminFetch<TaskListResponse>(url);
  },

  /**
   * Get a single task by ID.
   */
  get: async (id: string): Promise<Task> => {
    return adminFetch<Task>(`/tasks/${id}/`);
  },

  /**
   * Create a new task.
   */
  create: async (data: TaskCreateRequest): Promise<Task> => {
    return adminPost<Task>('/tasks/', data);
  },

  /**
   * Update an existing task.
   */
  update: async (id: string, data: TaskUpdateRequest): Promise<Task> => {
    return adminPatch<Task>(`/tasks/${id}/`, data);
  },

  /**
   * Delete a task.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete(`/tasks/${id}/`);
  },

  /**
   * Publish a task (make it available for AI suggestions).
   */
  publish: async (id: string): Promise<Task> => {
    return adminPost<Task>(`/tasks/${id}/publish/`, {});
  },

  /**
   * Archive a task (remove from AI suggestions).
   */
  archive: async (id: string): Promise<Task> => {
    return adminPost<Task>(`/tasks/${id}/archive/`, {});
  },

  /**
   * Get pre-built task templates.
   */
  getTemplates: async (): Promise<TaskTemplate[]> => {
    return adminFetch<TaskTemplate[]>('/tasks/templates/');
  },

  /**
   * Record that a task was executed.
   */
  recordExecution: async (id: string): Promise<{ execution_count: number; last_executed_at: string | null }> => {
    return adminPost<{ execution_count: number; last_executed_at: string | null }>(
      `/tasks/${id}/record-execution/`,
      {}
    );
  },

  /**
   * Get execution stats for a task.
   */
  getStats: async (id: string): Promise<TaskStatsResponse> => {
    return adminFetch<TaskStatsResponse>(`/tasks/${id}/stats/`);
  },

  /**
   * Generate task configuration from a natural language description using AI.
   * 
   * @param description - Natural language description of what the task should do
   * @returns Suggested task configuration (identifier, task_type, etc.)
   */
  generateSuggestion: async (description: string): Promise<TaskGenerationSuggestion> => {
    return adminPost<TaskGenerationSuggestion>('/tasks/generate-suggestion/', { description });
  },
};

