import { queryOptions } from '@tanstack/react-query';
import { mcpSourcesAPI } from '@/lib/admin/mcp-sources-api';
import type { CreateMCPToolSourcePayload } from '@/types/mcpSource';

export const mcpSourceKeys = {
  all: ['mcpSources'] as const,
  lists: () => [...mcpSourceKeys.all, 'list'] as const,
  list: (productId: string) => [...mcpSourceKeys.lists(), productId] as const,
  detail: (id: string) => [...mcpSourceKeys.all, 'detail', id] as const,
  resourceContent: (sourceId: string, uri: string) =>
    [...mcpSourceKeys.detail(sourceId), 'resource', uri] as const,
};

export const mcpSourceListQuery = (productId: string) =>
  queryOptions({
    queryKey: mcpSourceKeys.list(productId),
    queryFn: () => mcpSourcesAPI.list(productId),
    enabled: !!productId,
  });

export const mcpSourceDetailQuery = (id: string) =>
  queryOptions({
    queryKey: mcpSourceKeys.detail(id),
    queryFn: () => mcpSourcesAPI.get(id),
    enabled: !!id,
  });

export const createMcpSourceMutation = () => ({
  mutationFn: (data: CreateMCPToolSourcePayload) => mcpSourcesAPI.create(data),
});

export const refreshMcpSourceMutation = () => ({
  mutationFn: (id: string) => mcpSourcesAPI.refresh(id),
});

export const deleteMcpSourceMutation = () => ({
  mutationFn: (id: string) => mcpSourcesAPI.delete(id),
});

export const mcpResourceContentQuery = (sourceId: string, uri: string) =>
  queryOptions({
    queryKey: mcpSourceKeys.resourceContent(sourceId, uri),
    queryFn: () => mcpSourcesAPI.readResource(sourceId, uri),
    enabled: !!sourceId && !!uri,
  });
