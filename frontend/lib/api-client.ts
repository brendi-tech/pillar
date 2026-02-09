/**
 * API Client utilities
 * 
 * Server-side utilities for determining request context from Next.js headers.
 */
import { headers } from 'next/headers';

/**
 * Check if this is an admin request
 */
export async function isAdminRequest(): Promise<boolean> {
  const headersList = await headers();
  return headersList.get('x-is-admin') === 'true';
}

/**
 * Check if this is a marketing site request (root domain, no subdomain)
 */
export async function isMarketingRequest(): Promise<boolean> {
  const headersList = await headers();
  return headersList.get('x-is-marketing') === 'true';
}

/**
 * Get request pathname from headers (set by middleware)
 */
export async function getPathname(): Promise<string> {
  const headersList = await headers();
  return headersList.get('x-pathname') || '/';
}
