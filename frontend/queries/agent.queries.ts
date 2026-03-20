import { agentAPI } from '@/lib/admin/agent-api';
import { queryOptions } from '@tanstack/react-query';

export const agentKeys = {
  all: ['agent'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (productId: string) => [...agentKeys.lists(), productId] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
};

export const agentListQuery = (productId: string) =>
  queryOptions({
    queryKey: agentKeys.list(productId),
    queryFn: () => agentAPI.list(productId),
    enabled: !!productId,
  });

export const agentDetailQuery = (id: string) =>
  queryOptions({
    queryKey: agentKeys.detail(id),
    queryFn: () => agentAPI.get(id),
    enabled: !!id,
  });

export const createAgentMutation = () => ({
  mutationFn: ({ productId, data }: { productId: string; data: Parameters<typeof agentAPI.create>[1] }) =>
    agentAPI.create(productId, data),
});

export const updateAgentMutation = () => ({
  mutationFn: ({ id, data }: { id: string; data: Parameters<typeof agentAPI.update>[1] }) =>
    agentAPI.update(id, data),
});

export const deleteAgentMutation = () => ({
  mutationFn: agentAPI.delete,
});
