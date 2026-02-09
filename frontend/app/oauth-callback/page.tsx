'use client';

import { useEffect } from 'react';

/**
 * OAuth Callback Page
 *
 * Handles the redirect from OAuth providers (Google, GitHub).
 * This page runs in a popup window and posts the auth code back
 * to the opener window.
 */
export default function OAuthCallbackPage() {
  useEffect(() => {
    try {
      // Get URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (window.opener) {
        // Send data to opener window
        window.opener.postMessage(
          {
            code,
            state,
            error,
          },
          '*' // In production, specify your origin
        );

        // Close popup after a brief delay
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        console.error('No opener window found');
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hc-bg)]">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[var(--hc-primary)] border-r-transparent" />
        <p className="mt-4 text-[var(--hc-text-muted)]">Completing login...</p>
      </div>
    </div>
  );
}
