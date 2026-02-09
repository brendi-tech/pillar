/**
 * Helper functions for redirecting users in the admin subdomain architecture.
 * 
 * NEW ARCHITECTURE:
 * - Admin subdomain: admin.localhost / admin.trypillar.com
 * - Public subdomains: {customer}.localhost / {customer}.trypillar.com
 * - Marketing: localhost / trypillar.com
 */

const CURRENT_HELP_CENTER_KEY = 'pillar_current_help_center_id';

/**
 * Get the admin subdomain URL.
 * All admin functionality lives on the admin subdomain.
 */
export function getAdminSubdomainUrl(path: string = ''): string {
  if (typeof window === 'undefined') {
    return path || '/';
  }
  
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Local development
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return `http://admin.localhost:${port || '3001'}${path}`;
  }
  
  // Dev
  if (hostname.endsWith('.pillar.bot') || hostname === 'pillar.bot') {
    return `https://admin.pillar.bot${path}`;
  }
  
  // Production
  if (hostname.endsWith('.trypillar.com') || hostname === 'trypillar.com') {
    return `https://admin.trypillar.com${path}`;
  }
  
  return path || '/';
}

/**
 * Get the URL for managing a help center in admin.
 * Returns the admin content page - help center selection is handled by context.
 */
export function getAdminHelpCenterUrl(_subdomain?: string): string {
  return getAdminSubdomainUrl('/content');
}


/**
 * Get the stored help center ID from localStorage.
 */
export function getStoredHelpCenterId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(CURRENT_HELP_CENTER_KEY);
}

/**
 * Store the help center ID in localStorage.
 */
export function setStoredHelpCenterId(helpCenterId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(CURRENT_HELP_CENTER_KEY, helpCenterId);
}

/**
 * Clear the stored help center ID.
 */
export function clearStoredHelpCenterId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(CURRENT_HELP_CENTER_KEY);
}

// Type for help center redirect selection
export interface HelpCenterForRedirect {
  id: string;
  subdomain: string;
  name?: string;
  is_default?: boolean;
}

/**
 * Select the best help center to redirect to after login.
 * Priority:
 * 1. Previously stored help center (if still accessible)
 * 2. Default help center
 * 3. First available help center
 */
export function selectHelpCenterForRedirect(
  helpCenters: HelpCenterForRedirect[]
): HelpCenterForRedirect | null {
  if (helpCenters.length === 0) {
    return null;
  }
  
  // Check for stored preference
  const storedId = getStoredHelpCenterId();
  if (storedId) {
    const stored = helpCenters.find(hc => hc.id === storedId);
    if (stored) {
      return stored;
    }
  }
  
  // Check for default
  const defaultHc = helpCenters.find(hc => hc.is_default);
  if (defaultHc) {
    return defaultHc;
  }
  
  // Return first available
  return helpCenters[0];
}

/**
 * Get the redirect URL after successful login.
 * Returns URL to manage the user's help center in admin.
 */
export function getRedirectAfterLogin(
  helpCenters: HelpCenterForRedirect[]
): string {
  const selectedHc = selectHelpCenterForRedirect(helpCenters);
  
  if (!selectedHc) {
    // No help centers - go to onboarding
    return getAdminSubdomainUrl('/onboarding');
  }
  
  // Store the selected help center for next time
  setStoredHelpCenterId(selectedHc.id);
  
  // Redirect to admin page for this help center
  return getAdminHelpCenterUrl(selectedHc.subdomain);
}

// Legacy exports for backwards compatibility
export const getSubdomainAdminUrl = getAdminHelpCenterUrl;
export const getDemoSubdomainAdminUrl = () => getAdminSubdomainUrl('/');
