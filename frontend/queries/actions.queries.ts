/**
 * TanStack Query configurations for Actions API.
 *
 * Includes queries and mutations for actions.
 */
import { queryOptions } from '@tanstack/react-query';
import { actionsAPI, type ActionListParams } from '@/lib/admin/actions-api';
import type { ActionCreateRequest, ActionUpdateRequest, ActionListResponse } from '@/types/actions';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const actionKeys = {
  all: ['action'] as const,

  // Lists
  lists: () => [...actionKeys.all, 'list'] as const,
  list: (params?: ActionListParams) => [...actionKeys.lists(), params] as const,

  // Details
  details: () => [...actionKeys.all, 'detail'] as const,
  detail: (id: string) => [...actionKeys.details(), id] as const,

  // Stats
  stats: (id: string) => [...actionKeys.detail(id), 'stats'] as const,

  // Templates
  templates: () => [...actionKeys.all, 'templates'] as const,
};

// =============================================================================
// Query Options - Actions
// =============================================================================

/**
 * List all actions for the organization
 */
export const actionListQuery = (params?: ActionListParams) =>
  queryOptions({
    queryKey: actionKeys.list(params),
    queryFn: () => actionsAPI.list(params),
  });

/**
 * Infinite query options for paginated action list with optional search.
 * Search is enabled when params.search is >= 2 characters.
 */
export const actionListInfiniteOptions = (
  params?: ActionListParams,
  pageSize = 50
) => ({
  queryKey: actionKeys.list(params),
  queryFn: ({ pageParam }: { pageParam: unknown }) =>
    actionsAPI.list({
      ...params,
      page: pageParam as number,
      page_size: pageSize,
    }),
  getNextPageParam: (
    lastPage: ActionListResponse,
    allPages: ActionListResponse[]
  ) => (lastPage.next ? allPages.length + 1 : undefined),
  initialPageParam: 1 as unknown,
  enabled: params?.search ? params.search.length >= 2 : true,
});

/**
 * Get a single action by ID
 */
export const actionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: actionKeys.detail(id),
    queryFn: () => actionsAPI.get(id),
    enabled: !!id,
  });

/**
 * Get execution stats for an action
 */
export const actionStatsQuery = (id: string) =>
  queryOptions({
    queryKey: actionKeys.stats(id),
    queryFn: () => actionsAPI.getStats(id),
    enabled: !!id,
  });

/**
 * Get pre-built action templates
 */
export const actionTemplatesQuery = () =>
  queryOptions({
    queryKey: actionKeys.templates(),
    queryFn: () => actionsAPI.getTemplates(),
  });

// =============================================================================
// Mutations - Actions
// =============================================================================

/**
 * Create a new action
 */
export const createActionMutation = () => ({
  mutationFn: (data: ActionCreateRequest) => actionsAPI.create(data),
});

/**
 * Update an existing action
 */
export const updateActionMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: ActionUpdateRequest }) =>
    actionsAPI.update(id, data),
});

/**
 * Delete an action
 */
export const deleteActionMutation = () => ({
  mutationFn: (id: string) => actionsAPI.delete(id),
});

/**
 * Publish an action
 */
export const publishActionMutation = () => ({
  mutationFn: (id: string) => actionsAPI.publish(id),
});

/**
 * Archive an action
 */
export const archiveActionMutation = () => ({
  mutationFn: (id: string) => actionsAPI.archive(id),
});

/**
 * Record action execution
 */
export const recordActionExecutionMutation = () => ({
  mutationFn: (id: string) => actionsAPI.recordExecution(id),
});
