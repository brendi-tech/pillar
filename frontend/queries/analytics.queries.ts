/**
 * TanStack Query configurations for Analytics API.
 *
 * Focused on AI chat metrics - the primary analytics for Pillar.
 * Includes queries for AI usage, conversations trend, and conversations list/detail.
 */

import { analyticsAPI } from "@/lib/admin/analytics-api";
import type { AnalyticsDateRange, ConversationFilters } from "@/types/admin";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const analyticsKeys = {
  all: ["analytics"] as const,

  // AI Usage
  aiUsage: (range: AnalyticsDateRange) =>
    [...analyticsKeys.all, "ai-usage", range] as const,

  // Conversations Trend
  conversationsTrend: (range: AnalyticsDateRange) =>
    [...analyticsKeys.all, "conversations-trend", range] as const,

  // Conversations
  conversations: () => [...analyticsKeys.all, "conversations"] as const,
  conversationsList: (filters: ConversationFilters) =>
    [...analyticsKeys.conversations(), "list", filters] as const,
  conversationDetail: (id: string) =>
    [...analyticsKeys.conversations(), "detail", id] as const,

};

// =============================================================================
// Query Options
// =============================================================================

/**
 * Get AI usage statistics
 */
export const aiUsageQuery = (range: AnalyticsDateRange) =>
  queryOptions({
    queryKey: analyticsKeys.aiUsage(range),
    queryFn: () => analyticsAPI.getAIUsage(range),
  });

/**
 * Get AI conversations time series data
 */
export const conversationsTrendQuery = (range: AnalyticsDateRange) =>
  queryOptions({
    queryKey: analyticsKeys.conversationsTrend(range),
    queryFn: () => analyticsAPI.getConversationsTrend(range),
  });

// =============================================================================
// Conversations Queries
// =============================================================================

/**
 * List conversations with filtering
 */
export const conversationsListQuery = (filters: ConversationFilters = {}) =>
  queryOptions({
    queryKey: analyticsKeys.conversationsList(filters),
    queryFn: () => analyticsAPI.listConversations(filters),
  });

/**
 * Get single conversation details
 */
export const conversationDetailQuery = (conversationId: string) =>
  queryOptions({
    queryKey: analyticsKeys.conversationDetail(conversationId),
    queryFn: () => analyticsAPI.getConversation(conversationId),
    enabled: !!conversationId,
  });

