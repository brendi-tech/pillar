"use client";

import { Toaster } from "@/components/ui/sonner";
import { PillarSDKProvider } from "@/providers";
import { AdminAuthProvider } from "@/providers/AuthProvider";
import { IntercomProvider } from "@/providers/IntercomProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";

interface AdminProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides auth context for admin pages.
 * Used for pages outside the (admin) route group that still need auth context
 * (like /login, /signup, /logout).
 */
export function AdminProviders({ children }: AdminProvidersProps) {
  // Create QueryClient - memoized to prevent recreation on re-renders
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PillarSDKProvider>
        <AdminAuthProvider>
          <IntercomProvider>
            {children}
            <Toaster />
          </IntercomProvider>
        </AdminAuthProvider>
      </PillarSDKProvider>
    </QueryClientProvider>
  );
}
