// ============================================================================
// Help Center Theme Presets
// ============================================================================

export type ThemeId = 'compass' | 'harbor' | 'meridian' | 'vector' | 'anchor' | 'terminal';

export type IconStyle = 'outlined' | 'filled' | 'duotone' | 'bold' | 'thin';

export type CornerStyle = 'sharp' | 'rounded' | 'soft';

export type CardStyle = 'bordered' | 'elevated' | 'flat';

export interface ThemeColors {
  // Light mode
  light: {
    primary: string;
    primaryForeground: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    border: string;
  };
  // Dark mode
  dark: {
    primary: string;
    primaryForeground: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    border: string;
  };
}

export interface ThemeTypography {
  heading: string;
  body: string;
  mono: string;
}

export interface ThemePreset {
  id: ThemeId;
  name: string;
  tagline: string;
  description: string;
  bestFor: string[];

  // Visual settings
  colors: ThemeColors;
  typography: ThemeTypography;

  // Style settings
  defaultLayout: 'cards' | 'sidebar';
  defaultGridColumns: 2 | 3 | 4;
  iconStyle: IconStyle;
  corners: CornerStyle;
  cardStyle: CardStyle;

  // CSS values
  borderRadius: string;
  shadowStyle: 'none' | 'subtle' | 'soft' | 'medium';
  spacing: 'compact' | 'balanced' | 'spacious';
}

// ============================================================================
// Theme Definitions
// ============================================================================

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  // ---------------------------------------------------------------------------
  // Compass - Enterprise Confidence
  // ---------------------------------------------------------------------------
  compass: {
    id: 'compass',
    name: 'Compass',
    tagline: 'Professional support that instills trust',
    description: 'Corporate, secure, reliable - like a Fortune 500 support portal',
    bestFor: ['Enterprise SaaS', 'B2B', 'Fintech', 'Healthcare', 'Legal'],

    colors: {
      light: {
        primary: '#1E3A5F',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#4A90D9',
        primaryForeground: '#FFFFFF',
        background: '#09090B',
        surface: '#18181B',
        surfaceHover: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#27272A',
      },
    },

    typography: {
      heading: "'Merriweather', 'Georgia', serif",
      body: "'Inter', 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },

    defaultLayout: 'cards',
    defaultGridColumns: 3,
    iconStyle: 'outlined',
    corners: 'sharp',
    cardStyle: 'bordered',
    borderRadius: '4px',
    shadowStyle: 'none',
    spacing: 'compact',
  },

  // ---------------------------------------------------------------------------
  // Harbor - Light & Approachable
  // ---------------------------------------------------------------------------
  harbor: {
    id: 'harbor',
    name: 'Harbor',
    tagline: 'Friendly help that feels effortless',
    description: 'Airy, welcoming, consumer-friendly - like Apple Support',
    bestFor: ['Consumer Apps', 'DTC Brands', 'Lifestyle Products', 'E-commerce'],

    colors: {
      light: {
        primary: '#E57373',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#EF9A9A',
        primaryForeground: '#18181B',
        background: '#09090B',
        surface: '#18181B',
        surfaceHover: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#27272A',
      },
    },

    typography: {
      heading: "'Nunito', 'Avenir', sans-serif",
      body: "'Nunito', 'Avenir', sans-serif",
      mono: "'Fira Code', 'Monaco', monospace",
    },

    defaultLayout: 'cards',
    defaultGridColumns: 3,
    iconStyle: 'filled',
    corners: 'rounded',
    cardStyle: 'elevated',
    borderRadius: '28px',
    shadowStyle: 'soft',
    spacing: 'spacious',
  },

  // ---------------------------------------------------------------------------
  // Meridian - Calm & Knowledgeable
  // ---------------------------------------------------------------------------
  meridian: {
    id: 'meridian',
    name: 'Meridian',
    tagline: 'Wisdom meets warmth',
    description: 'Zen-like calm, authoritative but not cold - like Notion help',
    bestFor: ['Productivity Tools', 'Wellness Apps', 'Education Platforms', 'Knowledge Bases'],

    colors: {
      light: {
        primary: '#4A7C59',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#6B9B7A',
        primaryForeground: '#FFFFFF',
        background: '#09090B',
        surface: '#18181B',
        surfaceHover: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#27272A',
      },
    },

    typography: {
      heading: "'Lora', 'Cambria', serif",
      body: "'Source Sans 3', 'Helvetica Neue', sans-serif",
      mono: "'Source Code Pro', 'Menlo', monospace",
    },

    defaultLayout: 'sidebar',
    defaultGridColumns: 3,
    iconStyle: 'duotone',
    corners: 'soft',
    cardStyle: 'flat',
    borderRadius: '8px',
    shadowStyle: 'subtle',
    spacing: 'balanced',
  },

  // ---------------------------------------------------------------------------
  // Vector - Modern & Dynamic
  // ---------------------------------------------------------------------------
  vector: {
    id: 'vector',
    name: 'Vector',
    tagline: 'Bold support for bold products',
    description: 'Energetic, contemporary, startup energy - like Stripe docs vibe',
    bestFor: ['Startups', 'AI Products', 'Modern SaaS', 'Creative Tools'],

    colors: {
      light: {
        primary: '#7C3AED',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#A78BFA',
        primaryForeground: '#FFFFFF',
        background: '#09090B',
        surface: '#18181B',
        surfaceHover: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#27272A',
      },
    },

    typography: {
      heading: "'Space Grotesk', 'Arial', sans-serif",
      body: "'Inter', 'Roboto', sans-serif",
      mono: "'JetBrains Mono', 'Consolas', monospace",
    },

    defaultLayout: 'cards',
    defaultGridColumns: 2,
    iconStyle: 'bold',
    corners: 'rounded',
    cardStyle: 'elevated',
    borderRadius: '16px',
    shadowStyle: 'medium',
    spacing: 'balanced',
  },

  // ---------------------------------------------------------------------------
  // Anchor - Classic & Trustworthy
  // ---------------------------------------------------------------------------
  anchor: {
    id: 'anchor',
    name: 'Anchor',
    tagline: 'Established reliability',
    description: 'Traditional, banking-level trust - like Fidelity or established institutions',
    bestFor: ['Financial Services', 'Insurance', 'Professional Services', 'Legacy Brands'],

    colors: {
      light: {
        primary: '#92600E',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#D4A84B',
        primaryForeground: '#18181B',
        background: '#09090B',
        surface: '#18181B',
        surfaceHover: '#27272A',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#27272A',
      },
    },

    typography: {
      heading: "'Libre Baskerville', 'Times New Roman', serif",
      body: "'Open Sans', 'Helvetica', sans-serif",
      mono: "'IBM Plex Mono', 'Courier New', monospace",
    },

    defaultLayout: 'sidebar',
    defaultGridColumns: 3,
    iconStyle: 'filled',
    corners: 'soft',
    cardStyle: 'bordered',
    borderRadius: '6px',
    shadowStyle: 'subtle',
    spacing: 'spacious',
  },

  // ---------------------------------------------------------------------------
  // Terminal - Technical & Precise
  // ---------------------------------------------------------------------------
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    tagline: 'Developer-friendly support',
    description: 'Systematic, detailed, technical - like GitHub support center',
    bestFor: ['Developer Tools', 'APIs', 'Infrastructure', 'Technical Products'],

    colors: {
      light: {
        primary: '#0D9488',
        primaryForeground: '#FFFFFF',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceHover: '#F5F5F5',
        text: '#18181B',
        textMuted: '#71717A',
        border: '#E4E4E7',
      },
      dark: {
        primary: '#2DD4BF',
        primaryForeground: '#0D0D0D',
        background: '#0A0A0A',
        surface: '#141414',
        surfaceHover: '#1F1F1F',
        text: '#FAFAFA',
        textMuted: '#A1A1AA',
        border: '#262626',
      },
    },

    typography: {
      heading: "'JetBrains Mono', 'SF Mono', monospace",
      body: "'Inter', 'SF Pro', sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', monospace",
    },

    defaultLayout: 'sidebar',
    defaultGridColumns: 3,
    iconStyle: 'thin',
    corners: 'sharp',
    cardStyle: 'flat',
    borderRadius: '4px',
    shadowStyle: 'none',
    spacing: 'compact',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getThemePreset(themeId: ThemeId): ThemePreset {
  return THEME_PRESETS[themeId];
}

export function getThemeList(): ThemePreset[] {
  return Object.values(THEME_PRESETS);
}

export function getDefaultTheme(): ThemePreset {
  return THEME_PRESETS.compass;
}

/**
 * Get CSS variables for a theme
 * Outputs both standard Tailwind variables AND --hc-* variables
 */
export function getThemeCSSVariables(theme: ThemePreset, isDark: boolean = false): string {
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  const spacing = getThemeSpacing(theme.spacing);
  const corners = getThemeCorners(theme.corners);
  const shadow = getThemeShadow(theme.shadowStyle);
  const cardStyle = getCardStyleCSS(theme.cardStyle);

  return `
    --primary: ${colors.primary};
    --primary-foreground: ${colors.primaryForeground};
    --background: ${colors.background};
    --foreground: ${colors.text};
    --card: ${colors.surface};
    --card-foreground: ${colors.text};
    --popover: ${colors.surface};
    --popover-foreground: ${colors.text};
    --muted: ${colors.surface};
    --muted-foreground: ${colors.textMuted};
    --accent: ${colors.surfaceHover};
    --accent-foreground: ${colors.text};
    --border: ${colors.border};
    --input: ${colors.border};
    --ring: ${colors.primary};
    --radius: ${theme.borderRadius};
    --hc-primary: ${colors.primary};
    --hc-primary-foreground: ${colors.primaryForeground};
    --hc-background: ${colors.background};
    --hc-surface: ${colors.surface};
    --hc-surface-hover: ${colors.surfaceHover};
    --hc-text: ${colors.text};
    --hc-text-muted: ${colors.textMuted};
    --hc-border: ${colors.border};
    --hc-font-heading: ${theme.typography.heading};
    --hc-font-body: ${theme.typography.body};
    --hc-font-mono: ${theme.typography.mono};
    --hc-border-radius: ${theme.borderRadius};
    --hc-radius-sm: ${corners.small};
    --hc-radius-md: ${corners.medium};
    --hc-radius-lg: ${corners.large};
    --hc-shadow: ${shadow.base};
    --hc-shadow-hover: ${shadow.hover};
    --hc-card-padding: ${spacing.cardPadding};
    --hc-section-gap: ${spacing.sectionGap};
    --hc-content-gap: ${spacing.contentGap};
    --hc-card-border: ${cardStyle.border};
    --hc-card-shadow: ${cardStyle.shadow};
    --hc-card-shadow-hover: ${cardStyle.shadowHover};
    --hc-card-bg-hover: ${cardStyle.bgHover};
  `.trim();
}

/**
 * Get spacing values based on theme density
 */
export function getThemeSpacing(spacing: ThemePreset['spacing']): {
  cardPadding: string;
  sectionGap: string;
  contentGap: string;
} {
  switch (spacing) {
    case 'compact':
      return {
        cardPadding: '14px',
        sectionGap: '20px',
        contentGap: '10px',
      };
    case 'spacious':
      return {
        cardPadding: '32px',
        sectionGap: '56px',
        contentGap: '24px',
      };
    case 'balanced':
    default:
      return {
        cardPadding: '20px',
        sectionGap: '36px',
        contentGap: '16px',
      };
  }
}

/**
 * Get shadow CSS based on theme shadow style
 */
export function getThemeShadow(shadowStyle: ThemePreset['shadowStyle']): { base: string; hover: string } {
  switch (shadowStyle) {
    case 'none':
      return {
        base: 'none',
        hover: '0 2px 8px rgba(0, 0, 0, 0.08)',
      };
    case 'subtle':
      return {
        base: '0 1px 2px rgba(0, 0, 0, 0.05)',
        hover: '0 4px 12px rgba(0, 0, 0, 0.1)',
      };
    case 'soft':
      return {
        base: '0 4px 12px rgba(0, 0, 0, 0.08)',
        hover: '0 8px 24px rgba(0, 0, 0, 0.12)',
      };
    case 'medium':
      return {
        base: '0 4px 16px rgba(0, 0, 0, 0.12)',
        hover: '0 8px 32px rgba(0, 0, 0, 0.18)',
      };
    default:
      return {
        base: 'none',
        hover: '0 2px 8px rgba(0, 0, 0, 0.08)',
      };
  }
}

/**
 * Get corner radius values based on theme corner style
 */
export function getThemeCorners(corners: ThemePreset['corners']): {
  small: string;
  medium: string;
  large: string;
} {
  switch (corners) {
    case 'sharp':
      return {
        small: '2px',
        medium: '4px',
        large: '6px',
      };
    case 'rounded':
      return {
        small: '12px',
        medium: '20px',
        large: '28px',
      };
    case 'soft':
    default:
      return {
        small: '4px',
        medium: '8px',
        large: '12px',
      };
  }
}

/**
 * Get card style CSS based on theme card style
 * - bordered: visible border, no shadow, border darkens on hover
 * - elevated: no border, prominent shadow, lifts on hover
 * - flat: subtle/no border, subtle shadow, background tint on hover
 */
export function getCardStyleCSS(cardStyle: CardStyle): {
  border: string;
  shadow: string;
  shadowHover: string;
  bgHover: string;
} {
  switch (cardStyle) {
    case 'bordered':
      return {
        border: '1px solid var(--hc-border)',
        shadow: 'none',
        shadowHover: '0 1px 3px rgba(0, 0, 0, 0.08)',
        bgHover: 'transparent',
      };
    case 'elevated':
      return {
        border: 'none',
        shadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        shadowHover: '0 8px 24px rgba(0, 0, 0, 0.12)',
        bgHover: 'transparent',
      };
    case 'flat':
    default:
      return {
        border: '1px solid var(--hc-border)',
        shadow: 'none',
        shadowHover: 'none',
        bgHover: 'var(--hc-surface-hover)',
      };
  }
}
