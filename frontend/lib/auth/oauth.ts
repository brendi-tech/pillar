/**
 * OAuth utilities for the Help Center
 *
 * Handles OAuth popup flow and API calls to the Pillar backend.
 */

const API_URL = process.env.NEXT_PUBLIC_PILLAR_API_URL || 'http://localhost:8003';

// ============================================================================
// Types
// ============================================================================

export type OAuthProvider = 'google' | 'github';

export interface OAuthCallbackData {
  code: string;
  state: string;
  error?: string;
}

export interface OAuthAuthorizationResponse {
  authorization_url: string;
  state: string;
}

export interface OAuthCallbackResponse {
  token: string;
  refresh: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
  needs_organization: boolean;
  is_new_user: boolean;
  should_show_org_picker: boolean;
  matching_organizations: Array<{
    id: string;
    name: string;
    domain: string;
    member_count: number;
  }>;
}

// ============================================================================
// OAuth Popup
// ============================================================================

/**
 * Open an OAuth popup window and wait for the callback
 *
 * @param url - The OAuth authorization URL
 * @returns Promise that resolves with the callback data (code and state)
 */
export function openOAuthPopup(url: string): Promise<OAuthCallbackData> {
  return new Promise((resolve, reject) => {
    // Calculate popup position (center of screen)
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open popup window
    const popup = window.open(
      url,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    // Poll to check if popup was closed manually
    const pollInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollInterval);
        window.removeEventListener('message', messageHandler);
        reject(new Error('OAuth popup was closed'));
      }
    }, 500);

    // Listen for postMessage from the popup
    const messageHandler = (event: MessageEvent) => {
      // Verify the message has the expected structure
      if (event.data && typeof event.data === 'object') {
        const data = event.data as OAuthCallbackData;

        if (data.code || data.error) {
          // Clean up
          clearInterval(pollInterval);
          window.removeEventListener('message', messageHandler);
          popup.close();

          // Resolve or reject based on data
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data);
          }
        }
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

// ============================================================================
// OAuth API
// ============================================================================

/**
 * Get the OAuth authorization URL for a provider
 */
export async function getAuthorizationUrl(
  provider: OAuthProvider
): Promise<OAuthAuthorizationResponse> {
  const response = await fetch(`${API_URL}/api/auth/oauth/authorize/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  });

  if (!response.ok) {
    throw new Error('Failed to get authorization URL');
  }

  return response.json();
}

/**
 * Handle OAuth callback and exchange code for JWT token
 */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
  state: string
): Promise<OAuthCallbackResponse> {
  const response = await fetch(`${API_URL}/api/auth/oauth/callback/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider, code, state }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'OAuth callback failed');
  }

  return response.json();
}

/**
 * Complete OAuth flow - opens popup and returns tokens
 */
export async function performOAuthLogin(
  provider: OAuthProvider
): Promise<OAuthCallbackResponse> {
  // Get authorization URL from backend
  const { authorization_url, state } = await getAuthorizationUrl(provider);

  // Open popup and wait for callback
  const { code, state: returnedState } = await openOAuthPopup(authorization_url);

  // Verify state matches (CSRF protection)
  if (state !== returnedState) {
    throw new Error('Invalid state parameter');
  }

  // Exchange code for JWT token
  return handleOAuthCallback(provider, code, state);
}
