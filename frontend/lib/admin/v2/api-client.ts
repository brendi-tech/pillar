/**
 * V2 API client for the new domain-specific endpoints.
 *
 * Uses /api/admin/ base path for new app endpoints:
 * - /api/admin/products/
 * - /api/admin/content/
 * - /api/admin/sources/
 * - /api/admin/analytics/
 * - /api/admin/automation/
 */

import { apiClient, getStoredAccessToken, getCurrentOrganizationId } from '../api-client';
import axios from 'axios';

// =============================================================================
// V2 Fetch Helpers
// =============================================================================

interface FetchOptions {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
  /** Skip auto-adding organization param from localStorage */
  skipAutoContext?: boolean;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = '/admin';
}

/**
 * Authenticated fetch for V2 API endpoints.
 * Uses /api/v2/ as the base path.
 */
export async function v2Fetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = getStoredAccessToken();

  if (!token) {
    redirectToLogin();
    throw new Error('Not authenticated');
  }

  const { params, body, method = 'GET', headers, skipAutoContext } = options;

  // Build params with org ID
  const queryParams: Record<string, string> = {};

  // Auto-add organization context unless explicitly skipped
  if (!skipAutoContext) {
    const orgId = getCurrentOrganizationId();
    if (orgId && !params?.organization) {
      queryParams.organization = orgId;
    }
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams[key] = String(value);
      }
    });
  }

  try {
    const response = await apiClient.request({
      url: `/api/admin${endpoint}`,
      method,
      params: queryParams,
      data: body,
      headers,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        redirectToLogin();
        throw new Error('Unauthorized');
      }
      const errorData = error.response?.data as Record<string, string> | undefined;
      throw new Error(
        errorData?.detail || errorData?.message || `API error: ${error.response?.status}`
      );
    }
    throw error;
  }
}

/**
 * V2 POST request
 */
export async function v2Post<T>(endpoint: string, data: unknown): Promise<T> {
  let body = data;

  if (typeof data === 'object' && data !== null) {
    const orgId = getCurrentOrganizationId();
    if (orgId && !('organization' in data)) {
      body = { ...(body as object), organization: orgId };
    }
  }

  return v2Fetch<T>(endpoint, {
    method: 'POST',
    body,
  });
}

/**
 * V2 PATCH request
 */
export async function v2Patch<T>(endpoint: string, data: unknown): Promise<T> {
  return v2Fetch<T>(endpoint, {
    method: 'PATCH',
    body: data,
  });
}

/**
 * V2 PUT request
 */
export async function v2Put<T>(endpoint: string, data: unknown): Promise<T> {
  return v2Fetch<T>(endpoint, {
    method: 'PUT',
    body: data,
  });
}

/**
 * V2 DELETE request
 */
export async function v2Delete<T>(endpoint: string): Promise<T> {
  return v2Fetch<T>(endpoint, {
    method: 'DELETE',
  });
}

// =============================================================================
// Helper for product context (replaces help_center_config)
// =============================================================================

const CURRENT_PRODUCT_KEY = 'pillar_current_product_id';

export function getCurrentProductId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_PRODUCT_KEY);
}

export function setCurrentProductId(productId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_PRODUCT_KEY, productId);
}

export function clearCurrentProductId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_PRODUCT_KEY);
}

/**
 * Authenticated fetch with product context.
 * Automatically includes product ID in params.
 */
export async function v2FetchWithProduct<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const productId = getCurrentProductId();
  const params = options.params || {};

  if (productId && !params.product) {
    params.product = productId;
  }

  return v2Fetch<T>(endpoint, { ...options, params });
}

/**
 * V2 POST request with product context.
 */
export async function v2PostWithProduct<T>(endpoint: string, data: unknown): Promise<T> {
  let body = data;

  if (typeof data === 'object' && data !== null) {
    const productId = getCurrentProductId();
    if (productId && !('product' in data)) {
      body = { ...(body as object), product: productId };
    }

    const orgId = getCurrentOrganizationId();
    if (orgId && !('organization' in data)) {
      body = { ...(body as object), organization: orgId };
    }
  }

  return v2Fetch<T>(endpoint, {
    method: 'POST',
    body,
  });
}
