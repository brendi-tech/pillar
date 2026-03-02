// ============================================================================
// Help Center Config Types
// ============================================================================

import type { ThemeId } from '@/lib/themes';

export interface HelpCenterConfig {
  id: string;
  site: string;
  theme: ThemeId;
  branding: BrandingConfig;
  ai: AIConfig;
  embed?: EmbedConfig;
  // Code-First Actions
  sync_secret_configured?: boolean;
  sync_secrets_count?: number;
  created_at: string;
  updated_at: string;
  
  // Legacy fields - kept for API compatibility but no longer used in UI
  /** @deprecated No longer used - use embed.primaryColor instead */
  layout?: LayoutConfig;
  /** @deprecated No longer used - help center website only */
  header?: HeaderConfig;
  /** @deprecated No longer used - help center website only */
  footer?: FooterConfig;
  /** @deprecated No longer used - help center website only */
  features?: FeaturesConfig;
  /** @deprecated No longer used - help center website only */
  seo?: SEOConfig;
}

// --- Branding Config ---

export interface BrandingConfig {
  name: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  logoHeight: number;
  faviconUrl?: string;
  colors?: {
    primary?: string;
  };
}

// --- AI Config ---

export interface SuggestedQuestionConfig {
  text: string;
  pathPattern?: string; // Path pattern for filtering, e.g. "/pricing", "/blog/*", "/docs/**"
}

export interface AIConfig {
  enabled: boolean;
  assistantName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  suggestedQuestions: SuggestedQuestionConfig[];
  openOnLoad: boolean;
  /** @deprecated Not used by the SDK */
  fallbackMessage?: string;
  usageLimit?: number;
  usageCurrent?: number;
}

// --- Embed Config (for SDK) ---

export type PanelPosition = 'left' | 'right';
export type FloatingButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface EmbedPanelConfig {
  enabled: boolean;
  position: PanelPosition;
  width: number; // 320-480px, default 380
}

export interface EmbedFloatingButtonConfig {
  enabled: boolean;
  position: FloatingButtonPosition;
  label: string;
}

export interface EmbedFeaturesConfig {
  aiChatEnabled: boolean;
  searchEnabled: boolean;
  /** @deprecated Tooltips feature has been removed */
  tooltipsEnabled: boolean;
}

export interface EmbedSecurityConfig {
  publicKey?: string;
  allowedDomains: string[];
  restrictToAllowedDomains: boolean;
}

// --- Sidebar Tab Config ---

export interface SidebarTabConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export const DEFAULT_SIDEBAR_TABS: SidebarTabConfig[] = [
  { id: 'assistant', label: 'Assistant', enabled: true, order: 0 },
  { id: 'support', label: 'Support', enabled: false, order: 1 },
];

export interface EmbedConfig {
  panel: EmbedPanelConfig;
  floatingButton: EmbedFloatingButtonConfig;
  features: EmbedFeaturesConfig;
  security: EmbedSecurityConfig;
  sidebarTabs: SidebarTabConfig[];
  primaryColor?: string; // Override for SDK branding
}

// --- Default Embed Config ---

export const DEFAULT_EMBED_CONFIG: EmbedConfig = {
  panel: {
    enabled: true,
    position: 'right',
    width: 380,
  },
  floatingButton: {
    enabled: true,
    position: 'bottom-right',
    label: 'Help',
  },
  features: {
    aiChatEnabled: true,
    searchEnabled: true,
    tooltipsEnabled: false, // Deprecated - tooltips feature removed
  },
  security: {
    allowedDomains: [],
    restrictToAllowedDomains: false,
  },
  sidebarTabs: DEFAULT_SIDEBAR_TABS,
};

// ============================================================================
// LEGACY TYPES - Kept for API compatibility
// These types are no longer used in the UI but may still exist in the database
// ============================================================================

/** @deprecated No longer used in product assistant UI */
export type LayoutStyle = 'cards' | 'sidebar';

/** @deprecated No longer used in product assistant UI */
export interface LayoutConfig {
  style: LayoutStyle;
  gridColumns: 2 | 3 | 4;
  showArticleCount: boolean;
  showCategoryIcons: boolean;
  personas: PersonaConfig[];
  personasEnabled: boolean;
}

/** @deprecated No longer used in product assistant UI */
export interface PersonaConfig {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  order: number;
}

/** @deprecated No longer used in product assistant UI */
export interface HeaderConfig {
  showSearch: boolean;
  showDarkModeToggle: boolean;
  showVersionPicker: boolean;
  showLanguagePicker: boolean;
  contactButton: {
    enabled: boolean;
    text: string;
    url: string;
  };
  customLinks: HeaderLink[];
}

/** @deprecated No longer used in product assistant UI */
export interface HeaderLink {
  id: string;
  label: string;
  url: string;
  external: boolean;
}

/** @deprecated No longer used in product assistant UI */
export interface FooterConfig {
  showPoweredBy: boolean;
  copyrightText?: string;
  linkGroups: FooterLinkGroup[];
  socialLinks: SocialLink[];
}

/** @deprecated No longer used in product assistant UI */
export interface FooterLinkGroup {
  id: string;
  title: string;
  links: FooterLink[];
}

/** @deprecated No longer used in product assistant UI */
export interface FooterLink {
  id: string;
  label: string;
  url: string;
  external: boolean;
}

/** @deprecated No longer used in product assistant UI */
export interface SocialLink {
  id: string;
  platform: 'twitter' | 'github' | 'linkedin' | 'facebook' | 'youtube' | 'custom';
  url: string;
  label?: string;
}

/** @deprecated No longer used in product assistant UI */
export interface FeaturesConfig {
  display: {
    darkMode: boolean;
    showReadingTime: boolean;
    showLastUpdated: boolean;
    showTableOfContents: boolean;
    showRelatedArticles: boolean;
  };
  interaction: {
    enableFeedback: boolean;
    showContributors: boolean;
    editOnGitHub: {
      enabled: boolean;
      repositoryUrl?: string;
    };
  };
  search: {
    enabled: boolean;
    placeholder: string;
    showPopularSearches: boolean;
    showRecentSearches: boolean;
  };
  sections: SectionConfig[];
}

/** @deprecated No longer used in product assistant UI */
export interface SectionConfig {
  id: string;
  name: string;
  enabled: boolean;
  showOnHomepage: boolean;
  title: string;
  options?: {
    showThumbnails?: boolean;
    showDifficultyLevel?: boolean;
    showEstimatedTime?: boolean;
  };
}

/** @deprecated No longer used in product assistant UI */
export interface SEOConfig {
  titleTemplate: string;
  defaultDescription: string;
  ogImageUrl?: string;
  twitterHandle?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'verified' | 'active' | 'error';
}

// --- API Types ---

export interface UpdateConfigPayload {
  theme?: ThemeId;
  branding?: Partial<BrandingConfig>;
  ai?: Partial<AIConfig>;
  embed?: Partial<EmbedConfig>;
  // Legacy fields - still accepted by API
  layout?: Partial<LayoutConfig>;
  header?: Partial<HeaderConfig>;
  footer?: Partial<FooterConfig>;
  features?: Partial<FeaturesConfig>;
  seo?: Partial<SEOConfig>;
}

export interface UploadLogoResponse {
  url: string;
  type: 'light' | 'dark';
}

export interface UploadFaviconResponse {
  url: string;
}

export interface UploadOGImageResponse {
  url: string;
}

// --- Form State Types (for client-side form management) ---

export interface ConfigFormState {
  theme: ThemeId;
  branding: BrandingConfig;
  ai: AIConfig;
  embed?: EmbedConfig;
}
