/**
 * API client for Visitors (SDK identified users).
 */
import { v2Fetch } from './v2/api-client';

// =============================================================================
// Types
// =============================================================================

export interface VisitorConversation {
  id: string;
  title: string;
  status: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  first_user_message: string | null;
}

export interface Visitor {
  id: string;
  visitor_id: string;
  external_user_id: string | null;
  name: string;
  email: string;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  conversation_count: number;
  recent_conversations: VisitorConversation[];
}

export interface VisitorFilters {
  external_user_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface VisitorsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Visitor[];
}

// =============================================================================
// Visitors API
// =============================================================================

export const visitorsAPI = {
  /**
   * List visitors with pagination and filtering
   */
  listVisitors: async (filters: VisitorFilters = {}): Promise<VisitorsListResponse> => {
    const params: Record<string, string | number> = {};
    
    if (filters.external_user_id) params.external_user_id = filters.external_user_id;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.page_size) params.page_size = filters.page_size;
    
    return await v2Fetch<VisitorsListResponse>('/analytics/visitors/', {
      params,
    });
  },

  /**
   * Get a single visitor by ID
   */
  getVisitor: async (visitorId: string): Promise<Visitor> => {
    return await v2Fetch<Visitor>(`/analytics/visitors/${visitorId}/`);
  },
};
