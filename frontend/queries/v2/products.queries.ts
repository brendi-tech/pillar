/**
 * TanStack Query configurations for V2 Products API.
 *
 * Includes queries and mutations for:
 * - Product
 * - Platform
 * - Action
 * - ActionExecutionLog
 */

import { queryOptions } from '@tanstack/react-query';
import {
  productsAPI,
  platformsAPI,
  actionsAPI,
  actionExecutionLogsAPI,
} from '@/lib/admin/v2/products-api';
import type {
  CreateProductPayload,
  UpdateProductPayload,
  CreatePlatformPayload,
  UpdatePlatformPayload,
  CreateActionPayload,
  UpdateActionPayload,
  ActionStatus,
} from '@/types/v2/products';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const productKeys = {
  all: ['v2', 'product'] as const,

  // Products
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params?: { search?: string; is_default?: boolean; page?: number; page_size?: number }) =>
    [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  bySubdomain: (subdomain: string) => [...productKeys.all, 'subdomain', subdomain] as const,
  integrationStatus: (id: string) => [...productKeys.detail(id), 'integration-status'] as const,

  // Platforms
  platforms: () => [...productKeys.all, 'platforms'] as const,
  platformList: (params?: { data_source?: string; is_active?: boolean }) =>
    [...productKeys.platforms(), 'list', params] as const,
  platformDetail: (id: string) => [...productKeys.platforms(), 'detail', id] as const,

  // Actions
  actions: () => [...productKeys.all, 'actions'] as const,
  actionList: (params?: { status?: ActionStatus; search?: string }) =>
    [...productKeys.actions(), 'list', params] as const,
  actionDetail: (id: string) => [...productKeys.actions(), 'detail', id] as const,

  // Action Execution Logs
  actionLogs: () => [...productKeys.all, 'action-logs'] as const,
  actionLogList: (params?: { action?: string; status?: string }) =>
    [...productKeys.actionLogs(), 'list', params] as const,
  actionLogDetail: (id: string) => [...productKeys.actionLogs(), 'detail', id] as const,
};

// =============================================================================
// Product Queries
// =============================================================================

/**
 * List all products for the organization.
 */
export const productListQuery = (params?: {
  search?: string;
  is_default?: boolean;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: productKeys.list(params),
    queryFn: () => productsAPI.list(params),
  });

/**
 * Get a single product by ID.
 */
export const productDetailQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => productsAPI.get(id),
    enabled: !!id,
  });

/**
 * Get a product by subdomain.
 */
export const productBySubdomainQuery = (subdomain: string) =>
  queryOptions({
    queryKey: productKeys.bySubdomain(subdomain),
    queryFn: () => productsAPI.getBySubdomain(subdomain),
    enabled: !!subdomain,
  });

/**
 * Get SDK integration status for onboarding.
 * Polls every 5 seconds to check for updates.
 */
export const productIntegrationStatusQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.integrationStatus(id),
    queryFn: () => productsAPI.getIntegrationStatus(id),
    enabled: !!id,
    refetchInterval: 5000, // Poll every 5 seconds
  });

// =============================================================================
// Product Mutations
// =============================================================================

export const createProductMutation = () => ({
  mutationFn: (data: CreateProductPayload) => productsAPI.create(data),
});

export const updateProductMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateProductPayload }) =>
    productsAPI.update(id, data),
});

export const deleteProductMutation = () => ({
  mutationFn: (id: string) => productsAPI.delete(id),
});

export const setDefaultProductMutation = () => ({
  mutationFn: (id: string) => productsAPI.setDefault(id),
});

// =============================================================================
// Platform Queries
// =============================================================================

/**
 * List all platforms.
 */
export const platformListQuery = (params?: {
  data_source?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: productKeys.platformList(params),
    queryFn: () => platformsAPI.list(params),
  });

/**
 * Get a single platform by ID.
 */
export const platformDetailQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.platformDetail(id),
    queryFn: () => platformsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Platform Mutations
// =============================================================================

export const createPlatformMutation = () => ({
  mutationFn: (data: CreatePlatformPayload) => platformsAPI.create(data),
});

export const updatePlatformMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdatePlatformPayload }) =>
    platformsAPI.update(id, data),
});

export const deletePlatformMutation = () => ({
  mutationFn: (id: string) => platformsAPI.delete(id),
});

// =============================================================================
// Action Queries
// =============================================================================

/**
 * List all actions for the product.
 */
export const actionListQuery = (params?: {
  status?: ActionStatus;
  search?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: productKeys.actionList(params),
    queryFn: () => actionsAPI.list(params),
  });

/**
 * Get a single action by ID.
 */
export const actionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.actionDetail(id),
    queryFn: () => actionsAPI.get(id),
    enabled: !!id,
  });

// =============================================================================
// Action Mutations
// =============================================================================

export const createActionMutation = () => ({
  mutationFn: (data: CreateActionPayload) => actionsAPI.create(data),
});

export const updateActionMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: UpdateActionPayload }) =>
    actionsAPI.update(id, data),
});

export const deleteActionMutation = () => ({
  mutationFn: (id: string) => actionsAPI.delete(id),
});

export const executeActionMutation = () => ({
  mutationFn: ({ id, inputData }: { id: string; inputData?: Record<string, unknown> }) =>
    actionsAPI.execute(id, inputData),
});

// =============================================================================
// Action Execution Log Queries
// =============================================================================

/**
 * List execution logs.
 */
export const actionLogListQuery = (params?: {
  action?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) =>
  queryOptions({
    queryKey: productKeys.actionLogList(params),
    queryFn: () => actionExecutionLogsAPI.list(params),
  });

/**
 * Get a single execution log by ID.
 */
export const actionLogDetailQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.actionLogDetail(id),
    queryFn: () => actionExecutionLogsAPI.get(id),
    enabled: !!id,
  });

