import type { AdminUser } from "@/types/admin";
import {
  apiClient,
  getStoredAccessToken,
  getStoredRefreshToken,
  removeStoredAccessToken,
  removeStoredRefreshToken,
  setStoredAccessToken,
  setStoredRefreshToken,
} from "./api-client";

/**
 * Authentication utilities for the Help Center Admin.
 *
 * Uses JWT tokens stored in localStorage via api-client for authentication.
 * Login/logout logic is now handled by AuthProvider.
 */

// Re-export token functions from api-client for convenience
export const getAuthToken = getStoredAccessToken;
export const setAuthToken = setStoredAccessToken;
export const clearAuthToken = removeStoredAccessToken;
export const getRefreshToken = getStoredRefreshToken;
export const setRefreshToken = setStoredRefreshToken;
export const clearRefreshToken = removeStoredRefreshToken;

/**
 * Clear all auth tokens.
 */
export function clearAllTokens(): void {
  removeStoredAccessToken();
  removeStoredRefreshToken();
}

/**
 * Check if the user is authenticated (has a token).
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Handle auth callback - extract token(s) from URL params.
 * Supports both single-token OAuth callbacks (?token=...) and
 * dual-token impersonation callbacks (?access=...&refresh=...).
 */
export function handleAuthCallback(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);

  const accessParam = params.get("access");
  const refreshParam = params.get("refresh");
  if (accessParam && refreshParam) {
    clearAllTokens();
    setAuthToken(accessParam);
    setRefreshToken(refreshParam);
    const url = new URL(window.location.href);
    url.searchParams.delete("access");
    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.toString());
    return true;
  }

  const token = params.get("token");
  if (token) {
    setAuthToken(token);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
    return true;
  }

  return false;
}

/**
 * Fetch the currently authenticated admin user from the API.
 * Returns null if not authenticated or if the request fails.
 * Uses apiClient for automatic token refresh handling.
 */
export async function fetchAdminUser(): Promise<AdminUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await apiClient.get("/api/users/users/me/");
    const userData = response.data;

    // Map organizations from API response
    const organizations =
      userData.organizations?.map(
        (org: {
          id: string;
          name: string;
          role: string;
          plan?: string;
          subscription_status?: string;
        }) => ({
          id: org.id,
          name: org.name,
          role: org.role as "admin" | "member",
          plan: org.plan,
          subscription_status: org.subscription_status,
        })
      ) || [];

    return {
      id: userData.id,
      name:
        userData.name || userData.first_name || userData.email.split("@")[0],
      email: userData.email,
      avatar: userData.avatar || userData.profile_image || undefined,
      role: "admin", // Role comes from org membership, defaulting to admin for now
      organizations,
      primary_organization_id: userData.primary_organization_id || null,
    };
  } catch (error) {
    console.error("Failed to fetch user info:", error);
    // apiClient interceptor handles 401 and token refresh automatically
    return null;
  }
}
