/**
 * TanStack Query configurations for Visitors API and Unified Users.
 */

import {
  visitorsAPI,
  type VisitorFilters,
  type VisitorsListResponse,
  type UnifiedUsersFilters,
  type UnifiedUsersListResponse,
} from "@/lib/admin/visitors-api";
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

export const unifiedUsersKeys = {
  all: ["unified-users"] as const,
  lists: () => [...unifiedUsersKeys.all, "list"] as const,
  list: (filters: UnifiedUsersFilters) =>
    [...unifiedUsersKeys.lists(), filters] as const,
};

// =============================================================================
// Query Options
// =============================================================================

export const visitorsListQuery = (filters: VisitorFilters = {}) =>
  queryOptions({
    queryKey: visitorsKeys.list(filters),
    queryFn: () => visitorsAPI.listVisitors(filters),
  });

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

export const visitorDetailQuery = (visitorId: string) =>
  queryOptions({
    queryKey: visitorsKeys.detail(visitorId),
    queryFn: () => visitorsAPI.getVisitor(visitorId),
    enabled: !!visitorId,
  });

export const unifiedUsersInfiniteQuery = (
  filters: Omit<UnifiedUsersFilters, "page"> = {}
) =>
  infiniteQueryOptions({
    queryKey: [...unifiedUsersKeys.list(filters), "infinite"] as const,
    queryFn: ({ pageParam }) =>
      visitorsAPI.listUnifiedUsers({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: UnifiedUsersListResponse, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
  });
