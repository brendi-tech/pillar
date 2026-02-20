/**
 * Admin API client for Help Center admin dashboard.
 * Uses axios with JWT authentication and automatic token refresh.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { addYears } from "date-fns";
import Cookies from "universal-cookie";
import { debug } from "@/lib/debug";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

// =============================================================================
// Custom Error Classes
// =============================================================================

/**
 * API validation error with field-level error details.
 * Thrown when the API returns validation errors in DRF format: { field: [errors] }
 */
export class ApiValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = 'ApiValidationError';
    this.fieldErrors = fieldErrors;
  }

  /**
   * Get the first error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  /**
   * Check if a specific field has errors
   */
  hasFieldError(field: string): boolean {
    return !!this.fieldErrors[field]?.length;
  }
}

const CURRENT_ORG_KEY = "pillar_current_organization_id";
const CURRENT_PRODUCT_KEY = "pillar_current_product_id";

// Cookie keys for token storage
export const accessKey = "access_token";
export const refreshKey = "refresh_token";

/**
 * Get the cookie domain for sharing cookies across subdomains.
 * Returns undefined for production (cookies will use default domain),
 * and '.localhost' for local development to share across subdomains.
 */
function getCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const hostname = window.location.hostname;
  
  // Local development: use .localhost for sharing across subdomains
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return '.localhost';
  }
  
  // For pillar.bot (dev) and trypillar.com (prod), use the base domain
  if (hostname.endsWith('.pillar.bot') || hostname === 'pillar.bot') {
    return '.pillar.bot';
  }
  
  if (hostname.endsWith('.trypillar.com') || hostname === 'trypillar.com') {
    return '.trypillar.com';
  }
  
  // For other domains, let browser use default (current hostname)
  return undefined;
}

// =============================================================================
// Token Storage (Cookie-based with localStorage fallback for localhost)
// =============================================================================

// localStorage keys for localhost fallback
const LS_ACCESS_KEY = 'pillar_access_token';
const LS_REFRESH_KEY = 'pillar_refresh_token';

/**
 * Check if we're on localhost (where cookie sharing across subdomains is unreliable)
 */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1';
}

export const getStoredAccessToken = () => {
  // Try cookie first
  const cookies = new Cookies();
  const cookieToken = cookies.get(accessKey);
  if (cookieToken) return cookieToken;
  
  // Fallback to localStorage for localhost (where cookie domain sharing is unreliable)
  if (isLocalhost() && typeof window !== 'undefined') {
    return localStorage.getItem(LS_ACCESS_KEY);
  }
  
  return null;
};

export const setStoredAccessToken = (token: string) => {
  const cookies = new Cookies();
  const domain = getCookieDomain();
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  cookies.set(accessKey, token, {
    path: "/",
    expires: addYears(new Date(), 1),
    sameSite: "lax", // Use 'lax' to allow cookies on subdomain redirects
    secure: isSecure,
    ...(domain && { domain }),
  });
  
  // Also store in localStorage for localhost (where cookie domain sharing is unreliable)
  if (isLocalhost() && typeof window !== 'undefined') {
    localStorage.setItem(LS_ACCESS_KEY, token);
  }
};

export const removeStoredAccessToken = () => {
  const cookies = new Cookies();
  const domain = getCookieDomain();
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  cookies.remove(accessKey, {
    path: "/",
    sameSite: "lax",
    secure: isSecure,
    ...(domain && { domain }),
  });
  
  // Also remove from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_ACCESS_KEY);
  }
};

export const getStoredRefreshToken = () => {
  // Try cookie first
  const cookies = new Cookies();
  const cookieToken = cookies.get(refreshKey);
  if (cookieToken) return cookieToken;
  
  // Fallback to localStorage for localhost
  if (isLocalhost() && typeof window !== 'undefined') {
    return localStorage.getItem(LS_REFRESH_KEY);
  }
  
  return null;
};

export const setStoredRefreshToken = (token: string) => {
  const cookies = new Cookies();
  const domain = getCookieDomain();
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  cookies.set(refreshKey, token, {
    path: "/",
    expires: addYears(new Date(), 1),
    sameSite: "lax",
    secure: isSecure,
    ...(domain && { domain }),
  });
  
  // Also store in localStorage for localhost
  if (isLocalhost() && typeof window !== 'undefined') {
    localStorage.setItem(LS_REFRESH_KEY, token);
  }
};

export const removeStoredRefreshToken = () => {
  const cookies = new Cookies();
  const domain = getCookieDomain();
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  cookies.remove(refreshKey, {
    path: "/",
    sameSite: "lax",
    secure: isSecure,
    ...(domain && { domain }),
  });
  
  // Also remove from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_REFRESH_KEY);
  }
};

// Legacy aliases for backward compatibility
export const getAuthToken = getStoredAccessToken;
export const setAuthToken = setStoredAccessToken;
export const clearAuthToken = removeStoredAccessToken;

// =============================================================================
// Axios Client Setup
// =============================================================================

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Track request timings for debugging
const requestTimings = new WeakMap<InternalAxiosRequestConfig, number>();

// Request interceptor - add auth token and track timing
apiClient.interceptors.request.use((config) => {
  // Track request start time
  requestTimings.set(config, performance.now());
  
  debug.log('api', `➡️ ${config.method?.toUpperCase()} ${config.url}`);

  if (typeof window !== "undefined") {
    const publicEndpoints = [
      { path: "/api/users/users/", method: "POST" },
      { path: "/api/auth/token/", method: "POST" },
      { path: "/api/auth/oauth/", method: "POST" },
      { path: "/api/users/password-reset/", method: "POST" },
      { path: "/api/users/password-reset/confirm/", method: "POST" },
    ];

    const isPublicEndpoint = publicEndpoints.some(
      (endpoint) =>
        config.url?.includes(endpoint.path) &&
        config.method?.toUpperCase() === endpoint.method
    );

    if (!isPublicEndpoint) {
      const token = getStoredAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        debug.warn('api', `No auth token for request to ${config.url}`);
      }
    }
  }
  return config;
});

// Token refresh logic
const renewStoredToken = async () => {
  const refresh = getStoredRefreshToken();
  if (!refresh) throw new Error("Client is missing refresh token");

  const response = await apiClient.post("/api/auth/token/refresh/", {
    refresh,
  });
  return { access: response.data.access, refresh: response.data.refresh };
};

//@ts-ignore
let refreshingFunc = undefined;

 
const handleTokenExpiration = async (error: any) => {
  const originalConfig = error.config;

  const token = getStoredAccessToken();

  // Only refresh on 401 (Unauthorized), not 403 (Forbidden)
  // 403 means permission denied, not invalid token
  if (!token || error.response?.status !== 401) {
    return Promise.reject(error);
  }

  // Don't try to refresh token for auth endpoints
  if (
    originalConfig.url.includes("/auth/token/refresh") ||
    originalConfig.url.includes("/auth/logout") ||
    originalConfig.url.includes("/api/auth/token/")
  ) {
    return Promise.reject(error);
  }

  try {
    //@ts-ignore
    if (!refreshingFunc) refreshingFunc = renewStoredToken();

    const { access, refresh } = await refreshingFunc;
    setStoredAccessToken(access);
    setStoredRefreshToken(refresh);
    originalConfig.headers.Authorization = `Bearer ${access}`;

    try {
      const response = await apiClient.request(originalConfig);
      return response;
    } catch (innerErr) {
      //@ts-ignore
      Promise.resolve(innerErr);
    }
  } catch (err) {
    console.log("[Auth] Token refresh failed, redirecting to logout");
    return Promise.reject(err);
  } finally {
    refreshingFunc = undefined;
  }
};

// Response interceptor - handle token expiration and log timing
apiClient.interceptors.response.use(
  (res) => {
    // Log successful request timing
    const startTime = requestTimings.get(res.config);
    if (startTime) {
      const duration = performance.now() - startTime;
      const durationStr = duration > 1000 
        ? `${(duration / 1000).toFixed(2)}s` 
        : `${duration.toFixed(0)}ms`;
      
      if (duration > 1000) {
        debug.warn('api', `⬅️ SLOW ${res.config.method?.toUpperCase()} ${res.config.url} - ${res.status} in ${durationStr}`);
      } else {
        debug.log('api', `⬅️ ${res.config.method?.toUpperCase()} ${res.config.url} - ${res.status} in ${durationStr}`);
      }
      requestTimings.delete(res.config);
    }
    return res;
  },
  async (error: AxiosError) => {
    // Log failed request timing
    if (error.config) {
      const startTime = requestTimings.get(error.config);
      if (startTime) {
        const duration = performance.now() - startTime;
        const durationStr = duration > 1000 
          ? `${(duration / 1000).toFixed(2)}s` 
          : `${duration.toFixed(0)}ms`;
        debug.error('api', `⬅️ FAILED ${error.config.method?.toUpperCase()} ${error.config.url} - ${error.response?.status || 'network error'} in ${durationStr}`);
        requestTimings.delete(error.config);
      }
    }
    return await handleTokenExpiration(error);
  }
);

// =============================================================================
// Organization & Help Center Context
// =============================================================================

export function getCurrentOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_ORG_KEY);
}

export function getCurrentProductId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_PRODUCT_KEY);
}

// =============================================================================
// Admin Fetch Helpers (using axios)
// =============================================================================

interface FetchOptions {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
  /** Skip auto-adding organization and product params from localStorage */
  skipAutoContext?: boolean;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/admin";
}

/**
 * Authenticated fetch for admin API.
 */
export async function adminFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = getStoredAccessToken();

  if (!token) {
    redirectToLogin();
    throw new Error("Not authenticated");
  }

  const { params, body, method = "GET", headers, skipAutoContext } = options;

  // Build params with org and help center IDs
  const queryParams: Record<string, string> = {};

  // Auto-add organization and product context unless explicitly skipped
  if (!skipAutoContext) {
    const orgId = getCurrentOrganizationId();
    if (orgId && !params?.organization) {
      queryParams.organization = orgId;
    }

    const productId = getCurrentProductId();
    if (productId && !params?.product) {
      queryParams.product = productId;
    }
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
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
        removeStoredAccessToken();
        redirectToLogin();
        throw new Error("Unauthorized");
      }
      const errorData = error.response?.data as Record<string, unknown> | undefined;
      
      // Check for field-level validation errors (DRF format: { field: [errors] })
      if (errorData && typeof errorData === 'object') {
        // If it has detail or message, use that
        if (typeof errorData.detail === 'string') {
          throw new Error(errorData.detail);
        }
        if (typeof errorData.message === 'string') {
          throw new Error(errorData.message);
        }
        
        // Otherwise, check for field validation errors
        const fieldErrors: Record<string, string[]> = {};
        let hasFieldErrors = false;
        
        for (const [key, value] of Object.entries(errorData)) {
          if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
            fieldErrors[key] = value as string[];
            hasFieldErrors = true;
          }
        }
        
        if (hasFieldErrors) {
          const apiError = new ApiValidationError(
            Object.values(fieldErrors).flat().join(', '),
            fieldErrors
          );
          throw apiError;
        }
      }
      
      throw new Error(`API error: ${error.response?.status}`);
    }
    throw error;
  }
}

/**
 * Admin POST request
 */
export async function adminPost<T>(endpoint: string, data: unknown): Promise<T> {
  let body = data;

  if (typeof data === "object" && data !== null) {
    const orgId = getCurrentOrganizationId();
    if (orgId && !("organization" in data)) {
      body = { ...(body as object), organization: orgId };
    }

    const productId = getCurrentProductId();
    if (productId && !("product" in data)) {
      body = { ...(body as object), product: productId };
    }
  }

  return adminFetch<T>(endpoint, {
    method: "POST",
    body,
  });
}

/**
 * Admin PATCH request
 */
export async function adminPatch<T>(endpoint: string, data: unknown): Promise<T> {
  return adminFetch<T>(endpoint, {
    method: "PATCH",
    body: data,
  });
}

/**
 * Admin PUT request
 */
export async function adminPut<T>(endpoint: string, data: unknown): Promise<T> {
  return adminFetch<T>(endpoint, {
    method: "PUT",
    body: data,
  });
}

/**
 * Admin DELETE request
 */
export async function adminDelete<T>(endpoint: string): Promise<T> {
  return adminFetch<T>(endpoint, {
    method: "DELETE",
  });
}
