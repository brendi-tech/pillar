'use client';

import { Spinner } from '@/components/ui/spinner';
import { useEffect, useState } from 'react';

/**
 * Checks if we're on the admin subdomain.
 */
function isAdminSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'admin.localhost' || 
         hostname.startsWith('admin.') ||
         hostname === 'admin';
}

/**
 * Root page that handles different content based on subdomain.
 * 
 * Note: Marketing requests (localhost:3001, trypillar.com) are rewritten
 * by middleware to /m and never reach this page.
 * 
 * This page handles:
 * - Admin subdomain: Redirects to /knowledge (dashboard)
 * - Customer subdomain: Public help center home
 */
export default function RootPage() {
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (isAdminSubdomain()) {
      // Admin subdomain: redirect to knowledge (main page)
      window.location.href = '/knowledge';
    } else {
      // Other subdomains: layout handles the rendering
      setIsRedirecting(false);
    }
  }, []);

  // Loading state while checking/redirecting
  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <Spinner size="xl" className="text-orange-500" />
      </div>
    );
  }

  // For non-admin subdomains, render nothing - layout.tsx handles it
  return null;
}
