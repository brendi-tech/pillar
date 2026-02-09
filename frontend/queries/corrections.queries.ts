/**
 * TanStack Query configurations for Corrections API.
 *
 * Provides queries and mutations for managing corrections from conversation reviews.
 */

import { correctionsAPI } from '@/lib/admin/corrections-api';
import type { CreateCorrectionRequest } from '@/types/admin';
import { queryOptions } from '@tanstack/react-query';

// =============================================================================
// Query Keys Factory
// =============================================================================

export const correctionsKeys = {
  all: ['corrections'] as const,
  lists: () => [...correctionsKeys.all, 'list'] as const,
  list: (params?: { page?: number; page_size?: number }) =>
    [...correctionsKeys.lists(), params] as const,
  details: () => [...correctionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...correctionsKeys.details(), id] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * List corrections
 */
export const correctionsListQuery = (params?: { page?: number; page_size?: number }) =>
  queryOptions({
    queryKey: correctionsKeys.list(params),
    queryFn: () => correctionsAPI.listCorrections(params),
  });

/**
 * Get single correction
 */
export const correctionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: correctionsKeys.detail(id),
    queryFn: () => correctionsAPI.getCorrection(id),
    enabled: !!id,
  });

// =============================================================================
// Mutation Options
// =============================================================================

/**
 * Create correction mutation
 */
export const createCorrectionMutation = () => ({
  mutationFn: (data: CreateCorrectionRequest) => correctionsAPI.createCorrection(data),
});

/**
 * Reprocess correction mutation
 */
export const reprocessCorrectionMutation = () => ({
  mutationFn: (id: string) => correctionsAPI.reprocessCorrection(id),
});
