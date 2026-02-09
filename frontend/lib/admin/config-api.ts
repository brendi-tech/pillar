/**
 * Help Center Config API Client
 *
 * NOTE: This file contains STUB/MOCK implementations. The Help Center Config
 * backend API has not been fully implemented yet. All functions return mock
 * data or create temporary blob URLs for uploaded files.
 *
 * This is used by queries/config.queries.ts for the config management UI.
 * When the backend endpoints are ready, replace the mock implementations
 * with actual API calls (commented out examples are provided in each function).
 */
import type {
  HelpCenterConfig,
  UpdateConfigPayload,
  UploadLogoResponse,
  UploadFaviconResponse,
  UploadOGImageResponse,
} from '@/types/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_PILLAR_API_URL || '';

// ============================================================================
// Default Config Data (mock data until backend is ready)
// ============================================================================

const DEFAULT_CONFIG: HelpCenterConfig = {
  id: 'config-default',
  site: '',
  theme: 'compass',
  branding: {
    name: 'Help Center',
    logoLightUrl: undefined,
    logoDarkUrl: undefined,
    logoHeight: 32,
    faviconUrl: undefined,
    colors: {
      primary: '#0066FF',
    },
  },
  layout: {
    style: 'cards',
    gridColumns: 3,
    showArticleCount: true,
    showCategoryIcons: true,
    personasEnabled: false,
    personas: [],
  },
  header: {
    showSearch: true,
    showDarkModeToggle: true,
    showVersionPicker: false,
    showLanguagePicker: false,
    contactButton: {
      enabled: true,
      text: 'Contact Support',
      url: '',
    },
    customLinks: [],
  },
  footer: {
    showPoweredBy: true,
    copyrightText: '',
    linkGroups: [],
    socialLinks: [],
  },
  features: {
    display: {
      darkMode: true,
      showReadingTime: true,
      showLastUpdated: true,
      showTableOfContents: true,
      showRelatedArticles: true,
    },
    interaction: {
      enableFeedback: true,
      showContributors: false,
      editOnGitHub: {
        enabled: false,
        repositoryUrl: undefined,
      },
    },
    search: {
      enabled: true,
      placeholder: 'Search for help...',
      showPopularSearches: true,
      showRecentSearches: true,
    },
    sections: [],
  },
  ai: {
    enabled: true,
    assistantName: 'AI Assistant',
    welcomeMessage: "Hi! I'm here to help you find answers. Ask me anything!",
    inputPlaceholder: 'Type your question...',
    suggestedQuestions: [],
    openOnLoad: false,
    fallbackMessage: "I couldn't find an answer. Would you like to contact support?",
    usageLimit: 1000,
    usageCurrent: 0,
  },
  seo: {
    titleTemplate: '%s | Help Center',
    defaultDescription: 'Find answers to your questions in the Help Center.',
    ogImageUrl: undefined,
    twitterHandle: undefined,
    customDomain: undefined,
    customDomainStatus: undefined,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Config API
// ============================================================================

/**
 * Get the help center configuration for a site
 */
export async function getConfig(siteId: string): Promise<HelpCenterConfig> {
  // TODO: Replace with actual API call when backend is ready
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/config/`);
  // if (!response.ok) throw new Error('Failed to fetch config');
  // return response.json();

  // For now, return default config (until backend is ready)
  return { ...DEFAULT_CONFIG, site: siteId };
}

/**
 * Update the help center configuration
 */
export async function updateConfig(
  siteId: string,
  payload: UpdateConfigPayload
): Promise<HelpCenterConfig> {
  // TODO: Replace with actual API call when backend is ready
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/config/`, {
  //   method: 'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload),
  // });
  // if (!response.ok) throw new Error('Failed to update config');
  // return response.json();

  // For now, return mock data (until backend is ready)
  const current = await getConfig(siteId);
  return {
    ...current,
    ...payload,
    updated_at: new Date().toISOString(),
  } as HelpCenterConfig;
}

/**
 * Upload a logo (light or dark mode)
 */
export async function uploadLogo(
  siteId: string,
  file: File,
  type: 'light' | 'dark'
): Promise<UploadLogoResponse> {
  // TODO: Replace with actual API call
  // const formData = new FormData();
  // formData.append('logo', file);
  // formData.append('type', type);
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/config/upload-logo/`, {
  //   method: 'POST',
  //   body: formData,
  // });
  // if (!response.ok) throw new Error('Failed to upload logo');
  // return response.json();
  
  // Mock response
  return {
    url: URL.createObjectURL(file),
    type,
  };
}

/**
 * Upload a favicon
 */
export async function uploadFavicon(
  siteId: string,
  file: File
): Promise<UploadFaviconResponse> {
  // TODO: Replace with actual API call
  // const formData = new FormData();
  // formData.append('favicon', file);
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/config/upload-favicon/`, {
  //   method: 'POST',
  //   body: formData,
  // });
  // if (!response.ok) throw new Error('Failed to upload favicon');
  // return response.json();
  
  // Mock response
  return {
    url: URL.createObjectURL(file),
  };
}

/**
 * Upload an OG image for social sharing
 */
export async function uploadOGImage(
  siteId: string,
  file: File
): Promise<UploadOGImageResponse> {
  // TODO: Replace with actual API call
  // const formData = new FormData();
  // formData.append('og_image', file);
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/config/upload-og-image/`, {
  //   method: 'POST',
  //   body: formData,
  // });
  // if (!response.ok) throw new Error('Failed to upload OG image');
  // return response.json();
  
  // Mock response
  return {
    url: URL.createObjectURL(file),
  };
}

/**
 * Get custom domain status
 */
export async function getDomainStatus(siteId: string): Promise<{
  domain?: string;
  status: 'pending' | 'verified' | 'active' | 'error';
  sslActive: boolean;
  dnsRecords?: Array<{ type: string; name: string; value: string }>;
}> {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/domain/status/`);
  // if (!response.ok) throw new Error('Failed to fetch domain status');
  // return response.json();
  
  // Mock response
  return {
    status: 'active',
    sslActive: true,
  };
}

/**
 * Verify custom domain ownership
 */
export async function verifyDomain(siteId: string, domain: string): Promise<{
  verified: boolean;
  status: 'pending' | 'verified' | 'error';
  message?: string;
}> {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/api/help-center/${siteId}/domain/verify/`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ domain }),
  // });
  // if (!response.ok) throw new Error('Failed to verify domain');
  // return response.json();
  
  // Mock response
  return {
    verified: true,
    status: 'verified',
  };
}
