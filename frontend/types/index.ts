// ============================================================================
// Help Center Public Types
// ============================================================================

import type { ThemeId } from '@/lib/themes';

// --- Article Types ---

export interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Article content in markdown format */
  content: string;
  categoryId: string;
  category?: {
    slug: string;
    name?: string;
  } | string;
  createdAt: string;
  updatedAt: string;
  readingTime: string;
  relatedArticleIds?: string[];
  versions?: string[];
  seoTitle?: string;
  seoDescription?: string;
  personas?: string[];
  // Owner (conditionally returned based on config)
  ownerName?: string;
  ownerAvatarUrl?: string;
}

export interface ArticleReference {
  id: string;
  articleId: string;
  title: string;
  url: string;
  snippet?: string;
  categorySlug?: string;
  slug?: string;
}

// --- Category Types ---

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  articleCount: number;
  color?: string;
  order: number;
  children?: Category[];
}

// --- Search Types ---

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  content?: string;
  category: string;
  categorySlug: string;
  slug: string;
  score: number;
  highlights?: string[];
  article?: {
    id: string;
    slug: string;
    category: string;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: string;
  suggestions?: string[];
}

// --- AI Assistant Types ---

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: ArticleReference[];
  isStreaming?: boolean;
}

export interface AIAnswerResponse {
  answer: string;
  sources: ArticleReference[];
  followUpQuestions?: string[];
}

// --- Persona Types ---

export interface Persona {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface PersonasConfig {
  enabled: boolean;
  personas: Persona[];
}

// --- Version & Product Types ---

export interface Version {
  id: string;
  name: string;
  releaseDate: string;
  isLatest: boolean;
  isDeprecated?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

// --- Config Types ---

export interface BrandingConfig {
  name: string;
  logo: {
    light: string;
    dark: string;
    height: number;
  };
  favicon: string;
}

export interface ColorsConfig {
  primary: string;
  primaryForeground: string;
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface FontsConfig {
  heading: string;
  body: string;
  mono: string;
}

export interface LayoutConfig {
  style: 'cards' | 'list' | 'minimal';
  cards?: {
    columnsDesktop: number;
    showArticleCount: boolean;
    showCategoryIcons: boolean;
  };
}

export interface MultiProductConfig {
  enabled: boolean;
  style: 'tabs' | 'dropdown' | 'categories';
  products: Product[];
}

export interface VersioningConfig {
  enabled: boolean;
  versions: Version[];
  defaultVersion?: string;
  showVersionBanner?: boolean;
}

export interface AIAssistantConfig {
  enabled: boolean;
  name: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  position: 'left' | 'right';
  defaultOpen: boolean;
  avatar?: string;
  greeting?: string;
  placeholder?: string;
}

export interface HeaderConfig {
  showSearch: boolean;
  showVersionPicker: boolean;
  showProductPicker: boolean;
  showLanguagePicker: boolean;
  showDarkModeToggle: boolean;
  showContactButton: boolean;
  contactButtonText: string;
  contactButtonUrl: string;
  customLinks: { label: string; href: string }[];
}

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterLinkGroup {
  title: string;
  links: FooterLink[];
}

export interface SocialLink {
  platform: 'twitter' | 'github' | 'linkedin' | 'discord' | 'youtube';
  href: string;
  url?: string;
}

export interface FooterConfig {
  showPoweredByPillar: boolean;
  links: FooterLinkGroup[];
  socialLinks: SocialLink[];
  copyright: string;
}

export interface FeaturesConfig {
  darkMode: boolean;
  feedbackWidget: boolean;
  relatedArticles: boolean;
  tableOfContents: boolean;
  readingTime: boolean;
  lastUpdated: boolean;
  contributors: boolean;
  editOnGithub: boolean;
  copyPageDropdown?: boolean;
  search: {
    enabled: boolean;
    placeholder: string;
    showPopularSearches: boolean;
    showRecentSearches: boolean;
  };
}

export interface SectionConfig {
  enabled: boolean;
  title: string;
  showOnHome: boolean;
  autoPopulate: boolean;
  showThumbnails?: boolean;
  showDifficulty?: boolean;
  showEstimatedTime?: boolean;
}

export interface SectionsConfig {
  gettingStarted: SectionConfig;
  tutorials: SectionConfig;
}

export interface SEOConfig {
  titleTemplate: string;
  defaultDescription: string;
  ogImage: string;
  twitterHandle: string;
}

export interface DomainConfig {
  custom: string;
  ssl: boolean;
}

export interface LocalizationConfig {
  defaultLocale: string;
  supportedLocales: string[];
  autoDetect: boolean;
}

export interface SearchConfig {
  placeholder?: string;
  showPopular?: boolean;
  showRecent?: boolean;
}

export interface AIConfig {
  enabled?: boolean;
  greeting?: string;
  placeholder?: string;
  suggestedQuestions?: string[];
}

export interface HelpCenterConfig {
  theme?: ThemeId;
  branding: BrandingConfig;
  colors: ColorsConfig;
  fonts: FontsConfig;
  layout: LayoutConfig;
  multiProduct: MultiProductConfig;
  versioning: VersioningConfig;
  personas?: PersonasConfig;
  aiAssistant: AIAssistantConfig;
  header: HeaderConfig;
  footer: FooterConfig;
  features: FeaturesConfig;
  sections: SectionsConfig;
  seo: SEOConfig;
  domain: DomainConfig;
  localization: LocalizationConfig;
  search?: SearchConfig;
  ai?: AIConfig;
  mcpServerUrl?: string;
}

// --- Customer Context ---

export interface CustomerContext {
  customerId: string;
  config: HelpCenterConfig;
  categories: Category[];
  currentVersion?: Version;
  currentProduct?: Product;
  currentPersona?: Persona;
  currentLocale: string;
}

// Re-export admin config types
export * from './config';

// Re-export knowledge types
export * from './knowledge';

// Re-export task types
export * from './tasks';

// Re-export organization/team types
export * from './organization';

// Re-export theme types
export type { ThemeId, ThemePreset, IconStyle, CornerStyle } from '@/lib/themes';


