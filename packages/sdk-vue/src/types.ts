/**
 * Shared types for Pillar Vue SDK
 */

import type {
  Pillar,
  PillarConfig,
  PillarEvents,
  PillarState,
  TaskExecutePayload,
  ThemeConfig,
} from '@pillar-ai/sdk';
import type { Component, ComputedRef, Ref } from 'vue';

// ============================================================================
// Card Types
// ============================================================================

/**
 * Props passed to custom card components.
 */
export interface CardComponentProps<T = Record<string, unknown>> {
  /** Data extracted by the AI for this action */
  data: T;
  /** Called when user confirms the action */
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  /** Called when user cancels the action */
  onCancel: () => void;
  /** Called to report state changes (loading, success, error) */
  onStateChange?: (
    state: 'loading' | 'success' | 'error',
    message?: string
  ) => void;
}

/**
 * A Vue component that can be used as a custom card renderer.
 */
export type CardComponent<T = Record<string, unknown>> = Component<CardComponentProps<T>>;

// ============================================================================
// Context Types
// ============================================================================

export interface PillarContextValue {
  /** The Pillar SDK instance */
  pillar: Ref<Pillar | null>;

  /** Current SDK state */
  state: Ref<PillarState>;

  /** Whether the SDK is ready */
  isReady: ComputedRef<boolean>;

  /** Whether the panel is currently open */
  isPanelOpen: Ref<boolean>;

  /** Open the help panel */
  open: (options?: {
    view?: string;
    article?: string;
    search?: string;
    focusInput?: boolean;
  }) => void;

  /** Close the help panel */
  close: () => void;

  /** Toggle the help panel */
  toggle: () => void;

  /** Open a specific article */
  openArticle: (slug: string) => void;

  /** Open a specific category */
  openCategory: (slug: string) => Promise<void>;

  /** Perform a search */
  search: (query: string) => void;

  /** Navigate to a specific view */
  navigate: (view: string, params?: Record<string, string>) => void;

  /** Update the panel theme at runtime */
  setTheme: (theme: Partial<ThemeConfig>) => void;

  /** Enable or disable the text selection "Ask AI" popover */
  setTextSelectionEnabled: (enabled: boolean) => void;

  /** Subscribe to SDK events */
  on: <K extends keyof PillarEvents>(
    event: K,
    callback: (data: PillarEvents[K]) => void
  ) => () => void;
}

export interface PillarProviderProps {
  /**
   * Your product key from the Pillar app.
   * Get it at app.trypillar.com
   */
  productKey?: string;

  /**
   * @deprecated Use `productKey` instead. Will be removed in v1.0.
   */
  helpCenter?: string;

  /**
   * Additional SDK configuration
   *
   * Notable options:
   * - `panel.useShadowDOM`: Whether to isolate styles in Shadow DOM (default: false).
   *   Set to false to let custom cards inherit your app's CSS (Tailwind, etc.)
   */
  config?: Omit<PillarConfig, 'productKey' | 'helpCenter'>;

  /**
   * Handler called when a task action is triggered from the chat.
   * Use this to handle AI-suggested actions like opening modals, navigating, etc.
   */
  onTask?: (task: TaskExecutePayload) => void;

  /**
   * Custom card components to render for inline_ui type actions.
   * Map card type names to Vue components that will render the inline UI.
   */
  cards?: Record<string, CardComponent>;
}

export interface PillarPanelProps {
  /** Custom class name for the container */
  class?: string | string[] | Record<string, boolean>;

  /** Custom inline styles for the container */
  style?: import('vue').CSSProperties;
}
