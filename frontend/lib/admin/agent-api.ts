import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';
import type { Agent, CreateAgentPayload, UpdateAgentPayload } from '@/types/agent';

export const agentAPI = {
  list: async (productId: string): Promise<Agent[]> => {
    return adminFetch<Agent[]>(`/products/${productId}/agents/`);
  },

  get: async (id: string): Promise<Agent> => {
    return adminFetch<Agent>(`/agents/${id}/`);
  },

  create: async (productId: string, data: CreateAgentPayload): Promise<Agent> => {
    return adminPost<Agent>(`/products/${productId}/agents/`, data);
  },

  update: async (id: string, data: UpdateAgentPayload): Promise<Agent> => {
    return adminPatch<Agent>(`/agents/${id}/`, data);
  },

  delete: async (id: string): Promise<void> => {
    return adminDelete(`/agents/${id}/`);
  },
};
