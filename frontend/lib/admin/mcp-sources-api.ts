import { apiClient } from './api-client';
import type { MCPToolSource, MCPToolConfigItem, CreateMCPToolSourcePayload, MCPProbeResult } from '@/types/mcpSource';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || 'http://localhost:8003';

const BASE = '/api/tools/admin/mcp-sources';

export const mcpSourcesAPI = {
  get: async (id: string): Promise<MCPToolSource> => {
    const res = await apiClient.get<MCPToolSource>(`${BASE}/${id}/`);
    return res.data;
  },

  list: async (productId: string): Promise<MCPToolSource[]> => {
    const res = await apiClient.get<MCPToolSource[]>(`${BASE}/`, {
      params: { product_id: productId },
    });
    return Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
  },

  create: async (data: CreateMCPToolSourcePayload): Promise<MCPToolSource> => {
    const res = await apiClient.post<MCPToolSource>(`${BASE}/`, data);
    return res.data;
  },

  refresh: async (id: string): Promise<{ status: string }> => {
    const res = await apiClient.post<{ status: string }>(`${BASE}/${id}/refresh/`);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}/`);
  },

  probe: async (url: string): Promise<MCPProbeResult> => {
    const res = await apiClient.post<MCPProbeResult>(`${BASE}/probe/`, { url });
    return res.data;
  },

  readResource: async (
    sourceId: string,
    uri: string
  ): Promise<{ success: boolean; contents?: Array<{ uri: string; text?: string; mimeType?: string; blob?: string }>; error?: string }> => {
    const res = await apiClient.post(`${BASE}/${sourceId}/read-resource/`, { uri });
    return res.data;
  },

  updateToolConfigs: async (
    sourceId: string,
    updates: Array<{ tool_name: string; is_enabled?: boolean; requires_confirmation?: boolean }>,
  ): Promise<MCPToolConfigItem[]> => {
    const res = await apiClient.patch<MCPToolConfigItem[]>(
      `${BASE}/${sourceId}/tool-configs/`,
      updates,
    );
    return res.data;
  },

  getOAuthAuthorizeUrl: async (sourceId: string): Promise<string> => {
    const res = await apiClient.post<{ authorize_url: string }>(
      '/api/admin/oauth/mcp-authorize/',
      { source_id: sourceId },
    );
    return res.data.authorize_url;
  },
};
