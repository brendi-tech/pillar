/**
 * Mock Next.js components and hooks for Remotion rendering.
 * These allow components that use Next.js features to render in isolation.
 */

import React, { createContext, useContext } from "react";

// Mock pathname context
const PathnameContext = createContext<string>("/docs/features/chat");

/**
 * Mock usePathname hook - returns the pathname from context
 */
export function usePathname(): string {
  return useContext(PathnameContext);
}

/**
 * Mock useRouter hook - returns no-op router functions
 */
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  };
}

/**
 * Mock useSearchParams hook - returns empty URLSearchParams
 */
export function useSearchParams() {
  return new URLSearchParams();
}

/**
 * Mock Link component - renders as a regular anchor tag
 */
function Link({
  href,
  children,
  className,
  onClick,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  [key: string]: unknown;
}) {
  return (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  );
}

// Export as both named and default for compatibility with Next.js import patterns
export { Link };
export default Link;

/**
 * Provider to wrap components that need Next.js mocking
 */
export function MockNextProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  return (
    <PathnameContext.Provider value={pathname}>
      {children}
    </PathnameContext.Provider>
  );
}
