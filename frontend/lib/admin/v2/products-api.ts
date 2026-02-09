/**
 * V2 Products API
 *
 * API functions for the products app:
 * - Product (formerly HelpCenterConfig)
 * - Platform
 * - Action
 * - ActionExecutionLog
 */

import { v2Fetch, v2Post, v2Patch, v2Delete, v2FetchWithProduct, v2PostWithProduct } from './api-client';
import type {
  Product,
  ProductListResponse,
  CreateProductPayload,
  UpdateProductPayload,
  Platform,
  PlatformListResponse,
  CreatePlatformPayload,
  UpdatePlatformPayload,
  Action,
  ActionListResponse,
  CreateActionPayload,
  UpdateActionPayload,
  ActionExecutionLog,
  ActionExecutionLogListResponse,
  ActionStatus,
  SubdomainCheckResponse,
  SubdomainSuggestionResponse,
  IntegrationStatus,
} from '@/types/v2/products';

// =============================================================================
// Products API
// =============================================================================

export const productsAPI = {
  /**
   * List all products for the organization.
   */
  list: async (params?: {
    search?: string;
    is_default?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<ProductListResponse> => {
    return v2Fetch<ProductListResponse>('/products/', { params });
  },

  /**
   * Get a single product by ID.
   */
  get: async (id: string): Promise<Product> => {
    return v2Fetch<Product>(`/products/${id}/`);
  },

  /**
   * Create a new product.
   */
  create: async (data: CreateProductPayload): Promise<Product> => {
    return v2Post<Product>('/products/', data);
  },

  /**
   * Update an existing product.
   */
  update: async (id: string, data: UpdateProductPayload): Promise<Product> => {
    return v2Patch<Product>(`/configs/${id}/`, data);
  },

  /**
   * Delete a product.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/products/${id}/`);
  },

  /**
   * Set a product as the default for the organization.
   */
  setDefault: async (id: string): Promise<Product> => {
    return v2Post<Product>(`/products/${id}/set-default/`, {});
  },

  /**
   * Get product by subdomain.
   */
  getBySubdomain: async (subdomain: string): Promise<Product> => {
    return v2Fetch<Product>(`/products/by-subdomain/${subdomain}/`);
  },

  /**
   * Check if a subdomain is available.
   * Returns the sanitized subdomain and availability status.
   */
  checkSubdomain: async (subdomain: string): Promise<SubdomainCheckResponse> => {
    return v2Fetch<SubdomainCheckResponse>('/configs/check-subdomain/', {
      params: { subdomain },
    });
  },

  /**
   * Generate a subdomain suggestion from a website URL.
   * Extracts the domain name and checks availability.
   */
  suggestSubdomain: async (url: string): Promise<SubdomainSuggestionResponse> => {
    return v2Fetch<SubdomainSuggestionResponse>('/configs/suggest-subdomain/', {
      params: { url },
    });
  },

  /**
   * Get SDK integration status for onboarding.
   * Returns whether SDK has been initialized, actions registered, and actions executed.
   */
  getIntegrationStatus: async (id: string): Promise<IntegrationStatus> => {
    return v2Fetch<IntegrationStatus>(`/configs/${id}/integration-status/`);
  },
};

// =============================================================================
// Platforms API
// =============================================================================

export const platformsAPI = {
  /**
   * List all platforms (optionally filtered by data source).
   */
  list: async (params?: {
    data_source?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<PlatformListResponse> => {
    return v2FetchWithProduct<PlatformListResponse>('/products/platforms/', { params });
  },

  /**
   * Get a single platform by ID.
   */
  get: async (id: string): Promise<Platform> => {
    return v2Fetch<Platform>(`/products/platforms/${id}/`);
  },

  /**
   * Create a new platform.
   */
  create: async (data: CreatePlatformPayload): Promise<Platform> => {
    return v2Post<Platform>('/products/platforms/', data);
  },

  /**
   * Update an existing platform.
   */
  update: async (id: string, data: UpdatePlatformPayload): Promise<Platform> => {
    return v2Patch<Platform>(`/products/platforms/${id}/`, data);
  },

  /**
   * Delete a platform.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/products/platforms/${id}/`);
  },
};

// =============================================================================
// Actions API
// =============================================================================

export const actionsAPI = {
  /**
   * List all actions for the product.
   */
  list: async (params?: {
    status?: ActionStatus;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<ActionListResponse> => {
    return v2FetchWithProduct<ActionListResponse>('/products/actions/', { params });
  },

  /**
   * Get a single action by ID.
   */
  get: async (id: string): Promise<Action> => {
    return v2Fetch<Action>(`/products/actions/${id}/`);
  },

  /**
   * Create a new action.
   */
  create: async (data: CreateActionPayload): Promise<Action> => {
    return v2PostWithProduct<Action>('/products/actions/', data);
  },

  /**
   * Update an existing action.
   */
  update: async (id: string, data: UpdateActionPayload): Promise<Action> => {
    return v2Patch<Action>(`/products/actions/${id}/`, data);
  },

  /**
   * Delete an action.
   */
  delete: async (id: string): Promise<void> => {
    return v2Delete<void>(`/products/actions/${id}/`);
  },

  /**
   * Execute an action.
   */
  execute: async (id: string, inputData?: Record<string, unknown>): Promise<ActionExecutionLog> => {
    return v2Post<ActionExecutionLog>(`/products/actions/${id}/execute/`, { input_data: inputData || {} });
  },
};

// =============================================================================
// Action Execution Logs API
// =============================================================================

export const actionExecutionLogsAPI = {
  /**
   * List execution logs for an action.
   */
  list: async (params?: {
    action?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<ActionExecutionLogListResponse> => {
    return v2Fetch<ActionExecutionLogListResponse>('/products/action-logs/', { params });
  },

  /**
   * Get a single execution log by ID.
   */
  get: async (id: string): Promise<ActionExecutionLog> => {
    return v2Fetch<ActionExecutionLog>(`/products/action-logs/${id}/`);
  },
};

