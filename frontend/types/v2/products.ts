/**
 * V2 Products Types
 *
 * Types for the new products app models:
 * - Product (formerly HelpCenterConfig)
 * - Platform
 * - Action
 * - ActionExecutionLog
 */

// =============================================================================
// Product Types (formerly HelpCenterConfig)
// =============================================================================

// Language choices for AI responses
export type LanguageCode =
  | 'auto'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar';

export const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: 'auto', label: 'Auto-detect from browser' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
];

export interface Product {
  id: string;
  organization: string;
  name: string;
  subdomain: string | null;
  website_url: string;
  config: ProductConfig;
  is_default: boolean;
  auto_theme_generated: boolean;
  show_article_owner: boolean;
  default_language: LanguageCode;
  agent_guidance?: string;
  created_at: string;
  updated_at: string;
  // Computed
  public_url?: string;
}

export interface ProductConfig {
  branding?: ProductBranding;
  colors?: ProductColors;
  layout?: ProductLayout;
  features?: ProductFeatures;
  seo?: ProductSEO;
  embed?: ProductEmbed;
  [key: string]: unknown;
}

export interface ProductBranding {
  name?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  logoHeight?: number;
  faviconUrl?: string;
}

export interface ProductColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface ProductLayout {
  style?: 'cards' | 'list' | 'sidebar';
  gridColumns?: number;
  showArticleCount?: boolean;
  showCategoryIcons?: boolean;
  personasEnabled?: boolean;
  personas?: string[];
}

export interface ProductFeatures {
  display?: {
    darkMode?: boolean;
    showReadingTime?: boolean;
    showLastUpdated?: boolean;
    showTableOfContents?: boolean;
    showRelatedArticles?: boolean;
  };
  interaction?: {
    enableFeedback?: boolean;
    showContributors?: boolean;
    editOnGitHub?: {
      enabled?: boolean;
      repositoryUrl?: string;
    };
  };
  search?: {
    enabled?: boolean;
    placeholder?: string;
    showPopularSearches?: boolean;
    showRecentSearches?: boolean;
  };
  sections?: unknown[];
}

export interface ProductSEO {
  titleTemplate?: string;
  defaultDescription?: string;
  ogImageUrl?: string;
  twitterHandle?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'verified' | 'active' | 'error';
}

export interface ProductEmbed {
  enabled?: boolean;
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
}

export interface CreateProductPayload {
  name: string;
  subdomain?: string;
  website_url?: string;
  config?: Partial<ProductConfig>;
  is_default?: boolean;
}

export interface UpdateProductPayload {
  name?: string;
  subdomain?: string;
  website_url?: string;
  config?: Partial<ProductConfig>;
  is_default?: boolean;
  show_article_owner?: boolean;
  default_language?: LanguageCode;
  agent_guidance?: string;
}

// =============================================================================
// Platform Types
// =============================================================================

export type PlatformType =
  | 'desktop_web'
  | 'mobile_web'
  | 'ios_app'
  | 'android_app'
  | 'desktop_app';

export interface Platform {
  id: string;
  data_source: string;
  platform_type: PlatformType;
  name: string;
  is_active: boolean;
  config: PlatformConfig;
  scrape_cadence_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformConfig {
  viewport?: {
    width: number;
    height: number;
  };
  user_agent?: string;
  [key: string]: unknown;
}

export interface CreatePlatformPayload {
  data_source: string;
  platform_type: PlatformType;
  name?: string;
  config?: Partial<PlatformConfig>;
  scrape_cadence_hours?: number | null;
}

export interface UpdatePlatformPayload {
  name?: string;
  is_active?: boolean;
  config?: Partial<PlatformConfig>;
  scrape_cadence_hours?: number | null;
}

// =============================================================================
// Action Types
// =============================================================================

export type ActionType = 'click' | 'navigate' | 'input' | 'scroll' | 'wait' | 'custom';
export type ActionStatus = 'suggested' | 'draft' | 'active' | 'archived';
export type ImplementationStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface Action {
  id: string;
  organization: string;
  product: string;
  name: string;
  description: string;
  action_type: ActionType;
  trigger_config: ActionTriggerConfig;
  execution_config: ActionExecutionConfig;
  status: ActionStatus;
  implementation_status: ImplementationStatus;
  implementation_notes: string;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface ActionTriggerConfig {
  event?: string;
  selector?: string;
  url_pattern?: string;
  [key: string]: unknown;
}

export interface ActionExecutionConfig {
  steps?: ActionStep[];
  timeout_ms?: number;
  retry_count?: number;
  [key: string]: unknown;
}

export interface ActionStep {
  action: string;
  target?: string;
  value?: string;
  wait_ms?: number;
}

export interface CreateActionPayload {
  product: string;
  name: string;
  description?: string;
  action_type: ActionType;
  trigger_config?: ActionTriggerConfig;
  execution_config?: ActionExecutionConfig;
  status?: ActionStatus;
}

export interface UpdateActionPayload {
  name?: string;
  description?: string;
  action_type?: ActionType;
  trigger_config?: ActionTriggerConfig;
  execution_config?: ActionExecutionConfig;
  status?: ActionStatus;
  implementation_status?: ImplementationStatus;
  implementation_notes?: string;
}

// =============================================================================
// ActionExecutionLog Types
// =============================================================================

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ActionExecutionLog {
  id: string;
  organization: string;
  action: string;
  status: ExecutionStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ProductListResponse = PaginatedResponse<Product>;
export type PlatformListResponse = PaginatedResponse<Platform>;
export type ActionListResponse = PaginatedResponse<Action>;
export type ActionExecutionLogListResponse = PaginatedResponse<ActionExecutionLog>;

// =============================================================================
// Subdomain Types
// =============================================================================

export interface SubdomainCheckResponse {
  subdomain: string;
  available: boolean;
  valid: boolean;
  error?: string;
  /** Suggested alternative subdomain if the requested one is taken */
  suggestion?: string;
}

export interface SubdomainSuggestionResponse {
  suggestion: string;
  available: boolean;
}

// =============================================================================
// Integration Status Types
// =============================================================================

export interface IntegrationStatus {
  sdk_initialized: boolean;
  sdk_initialized_at: string | null;
  actions_registered: boolean;
  action_executed: boolean;
}
