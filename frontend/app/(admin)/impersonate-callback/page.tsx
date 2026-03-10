"use client";

import { FullScreenLoading } from "@/components/FullScreenLoading";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Receives access + refresh tokens from the Django admin impersonation action,
 * stores them, fetches the impersonated user profile, and redirects to the
 * dashboard. The tokens are picked up by handleAuthCallback() during the
 * AuthProvider init cycle, so this page just waits for the user to resolve
 * and then navigates away.
 */
export default function ImpersonateCallbackPage() {
  const { user, loginWithTokens } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const access = searchParams.get("access");
    const refresh = searchParams.get("refresh");

    if (access && refresh) {
      handled.current = true;
      loginWithTokens(access, refresh).then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("access");
        url.searchParams.delete("refresh");
        window.history.replaceState({}, "", url.pathname);
        router.replace("/");
      });
    } else if (user) {
      router.replace("/");
    }
  }, [searchParams, loginWithTokens, router, user]);

  return <FullScreenLoading />;
}
