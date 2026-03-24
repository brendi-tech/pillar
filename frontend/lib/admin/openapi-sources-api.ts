import { apiClient } from './api-client';
import type {
  OpenAPIToolSource,
  OpenAPIToolSourceVersion,
  OpenAPIOperationConfigItem,
  CreateOpenAPIToolSourcePayload,
  OpenAPIProbeResult,
} from '@/types/openAPISource';

const BASE = '/api/tools/admin/openapi-sources';

export const openAPISourcesAPI = {
  get: async (id: string): Promise<OpenAPIToolSource> => {
    const res = await apiClient.get<OpenAPIToolSource>(`${BASE}/${id}/`);
    return res.data;
  },

  list: async (productId: string): Promise<OpenAPIToolSource[]> => {
    const res = await apiClient.get<OpenAPIToolSource[]>(`${BASE}/`, {
      params: { product_id: productId },
    });
    return Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
  },

  create: async (data: CreateOpenAPIToolSourcePayload): Promise<OpenAPIToolSource> => {
    const res = await apiClient.post<OpenAPIToolSource>(`${BASE}/`, data);
    return res.data;
  },

  refresh: async (id: string): Promise<{ status: string }> => {
    const res = await apiClient.post<{ status: string }>(`${BASE}/${id}/refresh/`);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateOpenAPIToolSourcePayload>): Promise<OpenAPIToolSource> => {
    const res = await apiClient.patch<OpenAPIToolSource>(`${BASE}/${id}/`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}/`);
  },

  probe: async (payload: { spec_url?: string; spec_content?: string }): Promise<OpenAPIProbeResult> => {
    const res = await apiClient.post<OpenAPIProbeResult>(`${BASE}/probe/`, payload);
    return res.data;
  },

  listVersions: async (sourceId: string): Promise<OpenAPIToolSourceVersion[]> => {
    const res = await apiClient.get<OpenAPIToolSourceVersion[]>(`${BASE}/${sourceId}/versions/`);
    return Array.isArray(res.data) ? res.data : (res.data as any).results ?? [];
  },

  getVersion: async (sourceId: string, versionNumber: number): Promise<OpenAPIToolSourceVersion> => {
    const res = await apiClient.get<OpenAPIToolSourceVersion>(
      `${BASE}/${sourceId}/versions/${versionNumber}/`,
    );
    return res.data;
  },

  updateOperationConfigs: async (
    sourceId: string,
    updates: Array<{ tool_name: string; is_enabled?: boolean; requires_confirmation?: boolean }>,
  ): Promise<OpenAPIOperationConfigItem[]> => {
    const res = await apiClient.patch<OpenAPIOperationConfigItem[]>(
      `${BASE}/${sourceId}/operation-configs/`,
      updates,
    );
    return res.data;
  },
};
