/**
 * TanStack Query configurations for Visitors API.
 *
 * Visitors are SDK end-users identified via the identify() function.
 */

import { visitorsAPI, type VisitorFilters, type VisitorsListResponse } from "@/lib/admin/visitors-api";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const visitorsKeys = {
  all: ["visitors"] as const,

  lists: () => [...visitorsKeys.all, "list"] as const,
  list: (filters: VisitorFilters) =>
    [...visitorsKeys.lists(), filters] as const,

  details: () => [...visitorsKeys.all, "detail"] as const,
  detail: (id: string) => [...visitorsKeys.details(), id] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * List visitors with pagination and filtering
 */
export const visitorsListQuery = (filters: VisitorFilters = {}) =>
  queryOptions({
    queryKey: visitorsKeys.list(filters),
    queryFn: () => visitorsAPI.listVisitors(filters),
  });

/**
 * Infinite query for visitors list with scroll pagination
 */
export const visitorsListInfiniteQuery = (
  filters: Omit<VisitorFilters, "page"> = {}
) =>
  infiniteQueryOptions({
    queryKey: [...visitorsKeys.list(filters), "infinite"] as const,
    queryFn: ({ pageParam }) =>
      visitorsAPI.listVisitors({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: VisitorsListResponse, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
  });

/**
 * Get a single visitor by ID
 */
export const visitorDetailQuery = (visitorId: string) =>
  queryOptions({
    queryKey: visitorsKeys.detail(visitorId),
    queryFn: () => visitorsAPI.getVisitor(visitorId),
    enabled: !!visitorId,
  });
