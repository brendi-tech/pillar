import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const RETURN_TO_PARAM = "returnTo";
const DEFAULT_RETURN_PATH = "/content";
const IGNORED_RETURN_PATHS = ["/logout", "/login", "/signup"];

/**
 * Get the current returnTo value from URL search params.
 * Use this when you only need to read the returnTo value.
 */
export function useReturnToValue() {
  const searchParams = useSearchParams();
  return searchParams.get(RETURN_TO_PARAM);
}

/**
 * Navigate to a path while setting returnTo to the current pathname.
 * Use this when redirecting to login/auth pages and want to return afterward.
 */
export function useRedirectWithReturnTo() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (path: string, returnToPath: string = pathname) => {
      const url = new URL(path, window.location.origin);
      url.searchParams.set(RETURN_TO_PARAM, returnToPath);
      router.push(url.pathname + url.search);
    },
    [router, pathname]
  );
}

/**
 * Navigate to the returnTo path, or a default path if not set.
 * Use this after authentication to return to the original destination.
 * Ignores auth-related paths (logout, login, signup).
 */
export function useRedirectToReturnPath() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get(RETURN_TO_PARAM);

  const validReturnTo =
    returnTo && !IGNORED_RETURN_PATHS.includes(returnTo) ? returnTo : null;

  return useCallback(
    (defaultPath: string = DEFAULT_RETURN_PATH) => {
      router.push(validReturnTo || defaultPath);
    },
    [router, validReturnTo]
  );
}

/**
 * Build a URL string with returnTo param.
 * Use this for creating links (e.g., href) rather than programmatic navigation.
 */
export function buildReturnToUrl(path: string, returnToPath: string) {
  return `${path}?${RETURN_TO_PARAM}=${encodeURIComponent(returnToPath)}`;
}

