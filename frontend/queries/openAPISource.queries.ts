import { queryOptions } from '@tanstack/react-query';
import { openAPISourcesAPI } from '@/lib/admin/openapi-sources-api';
import type { CreateOpenAPIToolSourcePayload } from '@/types/openAPISource';

export const openAPISourceKeys = {
  all: ['openAPISources'] as const,
  lists: () => [...openAPISourceKeys.all, 'list'] as const,
  list: (productId: string) => [...openAPISourceKeys.lists(), productId] as const,
  detail: (id: string) => [...openAPISourceKeys.all, 'detail', id] as const,
  versions: (id: string) => [...openAPISourceKeys.all, 'versions', id] as const,
  versionDetail: (id: string, vn: number) => [...openAPISourceKeys.versions(id), vn] as const,
};

export const openAPISourceListQuery = (productId: string) =>
  queryOptions({
    queryKey: openAPISourceKeys.list(productId),
    queryFn: () => openAPISourcesAPI.list(productId),
    enabled: !!productId,
  });

export const openAPISourceDetailQuery = (id: string) =>
  queryOptions({
    queryKey: openAPISourceKeys.detail(id),
    queryFn: () => openAPISourcesAPI.get(id),
    enabled: !!id,
  });

export const createOpenAPISourceMutation = () => ({
  mutationFn: (data: CreateOpenAPIToolSourcePayload) => openAPISourcesAPI.create(data),
});

export const updateOpenAPISourceMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: Partial<CreateOpenAPIToolSourcePayload> }) =>
    openAPISourcesAPI.update(id, data),
});

export const refreshOpenAPISourceMutation = () => ({
  mutationFn: (id: string) => openAPISourcesAPI.refresh(id),
});

export const deleteOpenAPISourceMutation = () => ({
  mutationFn: (id: string) => openAPISourcesAPI.delete(id),
});

export const updateOperationConfigsMutation = () => ({
  mutationFn: ({
    sourceId,
    updates,
  }: {
    sourceId: string;
    updates: Array<{ tool_name: string; is_enabled?: boolean; requires_confirmation?: boolean }>;
  }) => openAPISourcesAPI.updateOperationConfigs(sourceId, updates),
});

export const openAPISourceVersionsQuery = (sourceId: string) =>
  queryOptions({
    queryKey: openAPISourceKeys.versions(sourceId),
    queryFn: () => openAPISourcesAPI.listVersions(sourceId),
    enabled: !!sourceId,
  });
