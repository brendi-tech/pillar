/**
 * Personas API module for Help Center admin dashboard.
 */
import { adminFetch, adminPost, adminPatch, adminDelete } from './api-client';

// ============================================================================
// API Payload Types (match backend serializers)
// ============================================================================

/**
 * Payload for creating a new persona.
 * Matches PersonaCreateSerializer fields.
 */
export interface CreatePersonaPayload {
  organization?: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
}

/**
 * Payload for updating a persona.
 * Matches PersonaUpdateSerializer fields.
 */
export interface UpdatePersonaPayload {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
}

/**
 * Backend persona response type.
 * Matches PersonaSerializer output.
 */
export interface BackendPersona {
  id: string;
  organization: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Persona list response from backend.
 */
export interface BackendPersonaListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BackendPersona[];
}

/**
 * Frontend persona type (matches PersonaConfig from types/config.ts).
 */
export interface AdminPersona {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Personas API
// ============================================================================

export const personasAPI = {
  /**
   * List personas with optional search and filters.
   */
  list: async (
    params?: { search?: string; page?: number; page_size?: number; is_active?: boolean }
  ): Promise<BackendPersonaListResponse> => {
    return adminFetch<BackendPersonaListResponse>('/content/personas/', { params });
  },

  /**
   * Get all personas (no pagination, for dropdowns).
   */
  listAll: async (): Promise<BackendPersona[]> => {
    // Fetch with large page size to get all personas
    const response = await adminFetch<BackendPersonaListResponse>('/content/personas/', {
      params: { page_size: 1000 },
    });
    return response.results;
  },

  /**
   * Get a single persona by ID.
   */
  get: async (id: string): Promise<BackendPersona> => {
    return adminFetch<BackendPersona>(`/content/personas/${id}/`);
  },

  /**
   * Create a new persona.
   */
  create: async (data: CreatePersonaPayload): Promise<BackendPersona> => {
    return adminPost<BackendPersona>('/content/personas/', data);
  },

  /**
   * Update an existing persona.
   */
  update: async (id: string, data: UpdatePersonaPayload): Promise<BackendPersona> => {
    return adminPatch<BackendPersona>(`/content/personas/${id}/`, data);
  },

  /**
   * Delete a persona.
   */
  delete: async (id: string): Promise<void> => {
    return adminDelete<void>(`/content/personas/${id}/`);
  },
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform a backend persona to the frontend AdminPersona format.
 */
export function transformBackendPersona(persona: BackendPersona): AdminPersona {
  return {
    id: persona.id,
    name: persona.name,
    slug: persona.slug,
    description: persona.description || '',
    icon: persona.icon || '',
    order: persona.order,
    is_active: persona.is_active,
    created_at: persona.created_at,
    updated_at: persona.updated_at,
  };
}

/**
 * Transform a list of backend personas to frontend format.
 */
export function transformBackendPersonas(personas: BackendPersona[]): AdminPersona[] {
  return personas.map(transformBackendPersona);
}
