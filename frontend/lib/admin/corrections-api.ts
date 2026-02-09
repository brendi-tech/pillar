/**
 * Corrections API client.
 *
 * Provides methods for creating and managing corrections from conversation reviews.
 */

import { v2FetchWithProduct } from './v2/api-client';
import type {
  CreateCorrectionRequest,
  CreateCorrectionResponse,
  Correction,
} from '@/types/admin';

export const correctionsAPI = {
  /**
   * Create a correction from a conversation message.
   * This processes the correction through LLM and creates a knowledge snippet.
   */
  createCorrection: async (
    data: CreateCorrectionRequest
  ): Promise<CreateCorrectionResponse> => {
    return await v2FetchWithProduct<CreateCorrectionResponse>(
      '/knowledge/corrections/create/',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get a single correction by ID.
   */
  getCorrection: async (id: string): Promise<Correction> => {
    return await v2FetchWithProduct<Correction>(`/knowledge/corrections/${id}/`);
  },

  /**
   * List corrections with optional filtering.
   */
  listCorrections: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<{
    count: number;
    next: string | null;
    previous: string | null;
    results: Correction[];
  }> => {
    return await v2FetchWithProduct('/knowledge/corrections/', { params });
  },

  /**
   * Reprocess a failed correction.
   */
  reprocessCorrection: async (id: string): Promise<{
    id: string;
    status: string;
    processed_title: string;
    success: boolean;
    error?: string;
  }> => {
    return await v2FetchWithProduct(`/knowledge/corrections/${id}/reprocess/`, {
      method: 'POST',
    });
  },
};
