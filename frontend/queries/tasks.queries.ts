/**
 * TanStack Query configurations for Tasks API.
 *
 * Includes queries and mutations for action tasks.
 */
import { queryOptions } from '@tanstack/react-query';
import { tasksAPI, type TaskListParams } from '@/lib/admin/tasks-api';
import type { TaskCreateRequest, TaskUpdateRequest } from '@/types/tasks';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const taskKeys = {
  all: ['task'] as const,

  // Lists
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params?: TaskListParams) => [...taskKeys.lists(), params] as const,

  // Details
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,

  // Stats
  stats: (id: string) => [...taskKeys.detail(id), 'stats'] as const,

  // Templates
  templates: () => [...taskKeys.all, 'templates'] as const,
};

// =============================================================================
// Query Options - Tasks
// =============================================================================

/**
 * List all tasks for the organization
 */
export const taskListQuery = (params?: TaskListParams) =>
  queryOptions({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksAPI.list(params),
  });

/**
 * Get a single task by ID
 */
export const taskDetailQuery = (id: string) =>
  queryOptions({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksAPI.get(id),
    enabled: !!id,
  });

/**
 * Get execution stats for a task
 */
export const taskStatsQuery = (id: string) =>
  queryOptions({
    queryKey: taskKeys.stats(id),
    queryFn: () => tasksAPI.getStats(id),
    enabled: !!id,
  });

/**
 * Get pre-built task templates
 */
export const taskTemplatesQuery = () =>
  queryOptions({
    queryKey: taskKeys.templates(),
    queryFn: () => tasksAPI.getTemplates(),
  });

// =============================================================================
// Mutations - Tasks
// =============================================================================

/**
 * Create a new task
 */
export const createTaskMutation = () => ({
  mutationFn: (data: TaskCreateRequest) => tasksAPI.create(data),
});

/**
 * Update an existing task
 */
export const updateTaskMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: TaskUpdateRequest }) =>
    tasksAPI.update(id, data),
});

/**
 * Delete a task
 */
export const deleteTaskMutation = () => ({
  mutationFn: (id: string) => tasksAPI.delete(id),
});

/**
 * Publish a task
 */
export const publishTaskMutation = () => ({
  mutationFn: (id: string) => tasksAPI.publish(id),
});

/**
 * Archive a task
 */
export const archiveTaskMutation = () => ({
  mutationFn: (id: string) => tasksAPI.archive(id),
});

/**
 * Record task execution
 */
export const recordTaskExecutionMutation = () => ({
  mutationFn: (id: string) => tasksAPI.recordExecution(id),
});

