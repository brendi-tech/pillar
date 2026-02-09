import { addDays, format, subDays } from 'date-fns';
import { v2FetchWithProduct } from './v2/api-client';
import type {
  AnalyticsDateRange,
  AIUsageResponse,
  ConversationsTrendResponse,
  ConversationsListResponse,
  ConversationFilters,
  ChatConversationDetail,
  ArticlePerformance,
  SearchQuery,
} from '@/types/admin';

// Response types for article and search analytics
interface TopArticlesResponse {
  articles: ArticlePerformance[];
  total: number;
}

interface LowPerformersResponse {
  articles: ArticlePerformance[];
  total: number;
}

interface SearchQueriesResponse {
  queries: SearchQuery[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// Analytics API - Focused on AI chat metrics
// ============================================================================

export const analyticsAPI = {
  /**
   * Get AI usage statistics
   */
  getAIUsage: async (range: AnalyticsDateRange): Promise<AIUsageResponse> => {
    return await v2FetchWithProduct<AIUsageResponse>('/analytics/insights/', {
      params: { start: range.start, end: range.end },
    });
  },

/**
   * Get AI conversations time series data
   */
  getConversationsTrend: async (range: AnalyticsDateRange): Promise<ConversationsTrendResponse> => {
    return await v2FetchWithProduct<ConversationsTrendResponse>('/analytics/insights/conversations-trend/', {
      params: { start: range.start, end: range.end },
    });
  },

  // ===========================================================================
  // Conversations API
  // ===========================================================================

  /**
   * List chat conversations with filtering and pagination
   */
  listConversations: async (filters: ConversationFilters = {}): Promise<ConversationsListResponse> => {
    const params: Record<string, string | number | boolean> = {};
    
    if (filters.status) params.status = filters.status;
    if (filters.started_at_gte) params.started_at_gte = filters.started_at_gte;
    if (filters.started_at_lte) {
      // Append end-of-day time if just a date (yyyy-MM-dd) to include the full day
      const lteValue = filters.started_at_lte;
      params.started_at_lte = lteValue.includes('T') ? lteValue : `${lteValue}T23:59:59`;
    }
    if (filters.has_negative_feedback !== undefined) params.has_negative_feedback = filters.has_negative_feedback;
    if (filters.query_type) params.query_type = filters.query_type;
    if (filters.intent_category) params.intent_category = filters.intent_category;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.page_size) params.page_size = filters.page_size;
    
    return await v2FetchWithProduct<ConversationsListResponse>('/analytics/conversations/', {
      params,
    });
  },

  /**
   * Get single conversation with full message details
   */
  getConversation: async (conversationId: string): Promise<ChatConversationDetail> => {
    return await v2FetchWithProduct<ChatConversationDetail>(`/analytics/conversations/${conversationId}/`);
  },

  // ===========================================================================
  // Article Analytics API
  // ===========================================================================

  /**
   * Get top performing articles
   */
  getTopArticles: async (range: AnalyticsDateRange, limit: number = 20): Promise<TopArticlesResponse> => {
    return await v2FetchWithProduct<TopArticlesResponse>('/analytics/insights/top-articles/', {
      params: { start: range.start, end: range.end, limit },
    });
  },

  /**
   * Get low performing articles
   */
  getLowPerformers: async (range: AnalyticsDateRange, limit: number = 10): Promise<LowPerformersResponse> => {
    return await v2FetchWithProduct<LowPerformersResponse>('/analytics/insights/low-performers/', {
      params: { start: range.start, end: range.end, limit },
    });
  },

  // ===========================================================================
  // Search Analytics API
  // ===========================================================================

  /**
   * Get search queries analytics
   */
  getSearchQueries: async (range: AnalyticsDateRange, page: number = 1, pageSize: number = 50): Promise<SearchQueriesResponse> => {
    return await v2FetchWithProduct<SearchQueriesResponse>('/analytics/insights/search-queries/', {
      params: { start: range.start, end: range.end, page, page_size: pageSize },
    });
  },

};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default date range (last 30 days)
 * Note: End date is set to tomorrow to ensure today is fully included
 * regardless of timezone differences between client and server.
 */
export function getDefaultDateRange(): AnalyticsDateRange {
  const now = new Date();
  const end = addDays(now, 1); // Tomorrow ensures today is fully included across timezones
  const start = subDays(now, 30);
  
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    preset: '30d',
  };
}

/**
 * Get date range from preset
 * Note: End date is set to tomorrow to ensure today is fully included
 * regardless of timezone differences between client and server.
 */
export function getDateRangeFromPreset(preset: '7d' | '30d' | '90d'): AnalyticsDateRange {
  const now = new Date();
  const end = addDays(now, 1); // Tomorrow ensures today is fully included across timezones
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const start = subDays(now, daysMap[preset]);
  
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    preset,
  };
}
