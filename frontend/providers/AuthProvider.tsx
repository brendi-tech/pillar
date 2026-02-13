"use client";

import { FullScreenLoading } from "@/components/FullScreenLoading";
import { Rerouter } from "@/components/Rerouter";
import { buildReturnToUrl } from "@/hooks";
import {
  clearAllTokens,
  fetchAdminUser,
  getAuthToken,
  handleAuthCallback,
  setAuthToken,
  setRefreshToken,
} from "@/lib/admin/auth";
import { debug } from "@/lib/debug";
import { useSetUser, useUser } from "@/store/global/userSlice/hooks";
import type { AdminUser } from "@/types/admin";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ============================================================================
// Auth Context
// ============================================================================

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Login with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Login with OAuth tokens */
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  /** Sign up with email, password, full name, optional invite code, and optional invitation token */
  signUp: (
    email: string,
    password: string,
    fullName: string,
    inviteCode?: string,
    invitationToken?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Hook to access auth context.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AdminAuthProvider");
  }
  return context;
}

// ============================================================================
// Auth Provider
// ============================================================================

const API_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

interface AdminAuthProviderProps {
  children: ReactNode;
  /**
   * If true, skip auth check (for development).
   * Set via NEXT_PUBLIC_SKIP_AUTH=true
   */
  skipAuth?: boolean;
}

/**
 * Provider that handles authentication for the admin dashboard.
 *
 * All auth happens on the admin subdomain (admin.localhost, admin.trypillar.com).
 *
 * On mount:
 * 1. Checks for token in URL (callback from OAuth)
 * 2. Checks for existing token in localStorage
 * 3. If no auth, redirects to /login
 */
export function AdminAuthProvider({
  children,
  skipAuth,
}: AdminAuthProviderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const user = useUser();
  const setUser = useSetUser();

  // Check if we should skip auth (development mode)
  const shouldSkipAuth =
    skipAuth || process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  // Function to refresh user data
  const refreshUser = useCallback(async () => {
    const adminUser = await fetchAdminUser();
    if (adminUser) {
      setUser(adminUser);
    }
  }, [setUser]);

  // Helper to fetch user after login
  const fetchUserAfterLogin = useCallback(async () => {
    const adminUser = await fetchAdminUser();
    if (!adminUser) {
      throw new Error("Failed to fetch user after login");
    }
    setUser(adminUser);
  }, [setUser]);

  // Login with email and password
  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_URL}/api/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid email or password");
      }

      const data = await response.json();
      setAuthToken(data.access);
      setRefreshToken(data.refresh);

      await fetchUserAfterLogin();
    },
    [fetchUserAfterLogin]
  );

  // Login with OAuth tokens (already have tokens from OAuth flow)
  const loginWithTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setAuthToken(accessToken);
      setRefreshToken(refreshToken);
      await fetchUserAfterLogin();
    },
    [fetchUserAfterLogin]
  );

  // Sign up with email, password, full name, optional invite code, and optional invitation token
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      inviteCode?: string,
      invitationToken?: string
    ) => {
      const response = await fetch(`${API_URL}/api/users/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username: email,
          full_name: fullName,
          ...(inviteCode && { invite_code: inviteCode }),
          ...(invitationToken && { invitation_token: invitationToken }),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Extract field errors from DRF validation response
        const fieldErrors: string[] = [];
        if (data.email?.[0]) fieldErrors.push(data.email[0]);
        if (data.username?.[0]) fieldErrors.push(data.username[0]);
        if (data.password?.[0]) fieldErrors.push(data.password[0]);
        if (data.invite_code?.[0]) fieldErrors.push(data.invite_code[0]);
        const errorMessage =
          data.detail || fieldErrors.join(". ") || "Registration failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setAuthToken(data.token);
      setRefreshToken(data.refresh);

      await fetchUserAfterLogin();
    },
    [fetchUserAfterLogin]
  );

  const logout = useCallback(() => {
    setIsLoading(true);
    queryClient.clear();
    setUser(null);
    router.push("/login");
    clearAllTokens();
    setIsLoading(false);
  }, [router, queryClient, setUser]);

  useEffect(() => {
    async function initAuth() {
      debug.time("auth", "initAuth");
      debug.authState("Starting auth initialization", { pathname });

      const isLogout = pathname === "/logout";
      if (isLogout) {
        debug.authState("Logout page detected, skipping auth");
        setIsLoading(false);
        debug.timeEnd("auth", "initAuth");
        return;
      }

      // Handle auth callback (token in URL from OAuth)
      debug.log("auth", "Handling auth callback");
      handleAuthCallback();

      // Check for existing token
      const token = getAuthToken();
      debug.authState("Token check", { hasToken: !!token, shouldSkipAuth });

      if (token || shouldSkipAuth) {
        debug.time("auth", "fetchAdminUser");
        debug.authState("Fetching admin user");
        // We have a token (or skipping auth), fetch user info from API
        const adminUser = await fetchAdminUser();
        debug.timeEnd("auth", "fetchAdminUser");

        if (adminUser) {
          debug.authState("User fetched successfully", {
            userId: adminUser.id,
            email: adminUser.email,
            orgsCount: adminUser.organizations?.length ?? 0,
          });
          setUser(adminUser);

          setIsLoading(false);
          debug.timeEnd("auth", "initAuth");
          return;
        }
        // Token was invalid or expired
        debug.authState("Token invalid or user fetch failed");
        setIsLoading(false);
        debug.timeEnd("auth", "initAuth");
        return;
      }

      // No token
      debug.authState("No token");
      setIsLoading(false);
      debug.timeEnd("auth", "initAuth");
    }

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading screen while checking auth
  if (isLoading) {
    return <FullScreenLoading />;
  }

  // Redirect to login if user is not authenticated
  // Allow accept-invite page to be viewed without auth (shows invitation preview)
  const isAuthPage = [
    "/login",
    "/signup",
    "/signup-beta",
    "/logout",
    "/accept-invite",
  ].includes(pathname) || pathname.startsWith("/oauth-callback");
  if (!isAuthPage && !user) {
    return <Rerouter route={buildReturnToUrl("/login", pathname)} />;
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
    refreshUser,
    login,
    loginWithTokens,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
