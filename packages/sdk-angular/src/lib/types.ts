/**
 * Shared types for Pillar Angular SDK
 */

import type {
  Pillar,
  PillarConfig,
  PillarEvents,
  PillarState,
  TaskExecutePayload,
  ThemeConfig,
} from '@pillar-ai/sdk';
import type { Signal, WritableSignal, Type } from '@angular/core';

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
 * An Angular component that can be used as a custom card renderer.
 * The component should accept CardComponentProps as inputs.
 */
export type CardComponent<T = Record<string, unknown>> = Type<CardComponentProps<T>>;

// ============================================================================
// Service Types
// ============================================================================

export interface PillarServiceState {
  /** The Pillar SDK instance */
  pillar: Signal<Pillar | null>;

  /** Current SDK state */
  state: WritableSignal<PillarState>;

  /** Whether the SDK is ready */
  isReady: Signal<boolean>;

  /** Whether the panel is currently open */
  isPanelOpen: WritableSignal<boolean>;
}

export interface PillarServiceActions {
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

  /** Register a task handler */
  onTask: (
    taskName: string,
    handler: (data: Record<string, unknown>) => void
  ) => () => void;

  /** Get the Pillar SDK instance */
  getInstance: () => Pillar | null;
}

export interface PillarContextValue extends PillarServiceState, PillarServiceActions {}

// ============================================================================
// Provider Types
// ============================================================================

export interface PillarInitConfig {
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
   * Map card type names to Angular components that will render the inline UI.
   */
  cards?: Record<string, CardComponent>;
}

// ============================================================================
// Inject Function Types
// ============================================================================

export interface InjectPillarResult extends PillarContextValue {}

export interface InjectHelpPanelResult {
  /** Whether the panel is currently open */
  isOpen: Signal<boolean>;

  /** Open the panel */
  open: (options?: { view?: string; article?: string; search?: string }) => void;

  /** Close the panel */
  close: () => void;

  /** Toggle the panel */
  toggle: () => void;

  /** Open a specific article in the panel */
  openArticle: (slug: string) => void;

  /** Open a specific category in the panel */
  openCategory: (slug: string) => Promise<void>;

  /** Open search with a query */
  openSearch: (query?: string) => void;

  /** Open the AI chat */
  openChat: () => void;
}
