/**
 * Type declarations for @pillar-ai/react
 *
 * These stub types allow type-checking to pass in CI without building the SDK.
 * The actual types come from packages/sdk-react when running locally.
 *
 * Update these stubs if the SDK API changes significantly.
 */

declare module "@pillar-ai/react" {
  import type { ReactNode } from "react";

  export type ThemeMode = "light" | "dark" | "auto";

  export interface ThemeColors {
    primary?: string;
    primaryHover?: string;
    background?: string;
    backgroundSecondary?: string;
    text?: string;
    textMuted?: string;
    border?: string;
    borderLight?: string;
    outlineColor?: string;
  }

  export interface ThemeConfig {
    mode?: ThemeMode;
    colors?: ThemeColors;
    darkColors?: ThemeColors;
    fontFamily?: string;
  }

  export interface PanelConfig {
    enabled?: boolean;
    position?: "left" | "right";
    mode?: "push" | "overlay";
    width?: number;
  }

  export interface FloatingButtonConfig {
    enabled?: boolean;
    position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  }

  export interface EdgeTriggerConfig {
    enabled?: boolean;
  }

  export interface MobileTriggerConfig {
    enabled?: boolean;
  }

  export interface SidebarTabConfig {
    id: string;
    label: string;
    enabled: boolean;
    order: number;
    icon?:
      | "help"
      | "support"
      | "settings"
      | "feedback"
      | "chat"
      | "calendar"
      | "mail";
  }

  export interface PillarConfig {
    apiBaseUrl?: string;
    panel?: PanelConfig;
    floatingButton?: FloatingButtonConfig;
    edgeTrigger?: EdgeTriggerConfig;
    mobileTrigger?: MobileTriggerConfig;
    sidebarTabs?: SidebarTabConfig[];
    theme?: ThemeConfig;
    customCSS?: string;
  }

  export interface PillarEvents {
    "sidebar:click": { tabId: string; label: string };
    "support:request": { tabId: string };
    [key: string]: Record<string, unknown>;
  }

  export interface PillarProviderProps {
    children: ReactNode;
    /** Your product key from the Pillar app */
    productKey?: string;
    /** @deprecated Use `productKey` instead */
    helpCenter?: string;
    /** Additional SDK configuration */
    config?: PillarConfig;
    /** Handler called when a task action is triggered from the chat */
    onTask?: (task: { id?: string; name: string; taskType?: string; data: Record<string, unknown>; path?: string; externalUrl?: string }) => void;
    /** Custom card components for inline_ui type actions */
    cards?: Record<string, any>;
    /** Enable DOM scanning to send page context with messages */
    domScanning?: boolean;
  }

  export function PillarProvider(props: PillarProviderProps): JSX.Element;

  export interface PillarOpenOptions {
    view?: string;
    article?: string;
    search?: string;
    focusInput?: boolean;
  }

  /**
   * Chat context for escalation to human support.
   */
  export interface ChatContext {
    /** Server-assigned conversation ID, or null if not yet assigned */
    conversationId: string | null;
    /** Messages in the conversation */
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
  }

  export interface PillarInstance {
    setContext: (context: Record<string, unknown>) => void;
    onTask: (
      taskName: string,
      handler: (data: Record<string, unknown>) => void | Promise<void>
    ) => () => void;
    on: <K extends keyof PillarEvents>(
      event: K,
      callback: (data: PillarEvents[K]) => void
    ) => () => void;
    open: (options?: PillarOpenOptions) => void;
    close: () => void;
    isOpen: boolean;
    /**
     * Get the current chat context (conversation ID and messages).
     * Useful for escalation to human support with conversation history.
     */
    getChatContext: () => ChatContext | null;
    /**
     * Identify the current user for conversation history tracking.
     * Links anonymous conversations to the authenticated user.
     */
    identify: (
      userId: string,
      profile?: {
        name?: string;
        email?: string;
        metadata?: Record<string, unknown>;
      }
    ) => Promise<void>;
    /**
     * Clear the user's identity (logout).
     * Future conversations will be tracked anonymously.
     */
    logout: () => void;
  }

  // ============================================================================
  // Type utilities for typed onTask (mirrors @pillar-ai/sdk)
  // ============================================================================

  /**
   * Action definitions type - simplified for stub types.
   * The full type inference works when using the actual @pillar-ai/sdk package.
   */

  export type SyncActionDefinitions = Record<string, any>;
  export type ActionDefinitions = SyncActionDefinitions;

  /**
   * Base data types for each action type.
   */
  export interface NavigateActionData {
    highlight_selector?: string;
    path?: string;
  }

  export interface TriggerActionData {
    action?: string;
    [key: string]: unknown;
  }

  export interface InlineUIData {
    card_type: string;
    [key: string]: unknown;
  }

  /**
   * Maps action types to their default data shapes.
   */
  export interface ActionTypeDataMap {
    navigate: NavigateActionData;
    trigger_tool: TriggerActionData;
    trigger_action: TriggerActionData; // @deprecated alias for trigger_tool
    inline_ui: InlineUIData;
    external_link: Record<string, unknown>;
    copy_text: { text?: string };
    open_modal: Record<string, unknown>;
    fill_form: Record<string, unknown>;
    start_tutorial: Record<string, unknown>;
  }

  /**
   * Extract data type from an action definition.
   * Priority: defaultData > action type > fallback
   */
  export type ActionDataType<
    TActions,
    TName extends keyof TActions,
  > = TActions[TName] extends { defaultData: infer D }
    ? D
    : TActions[TName] extends { type: infer T }
      ? T extends keyof ActionTypeDataMap
        ? ActionTypeDataMap[T]
        : Record<string, unknown>
      : Record<string, unknown>;

  /**
   * Extract action names from an ActionDefinitions map.
   */
  export type ActionNames<T> = Extract<keyof T, string>;

  // ============================================================================
  // usePillar hook with typed onTask
  // ============================================================================

  export interface PillarContextValue {
    /** The Pillar SDK instance */
    pillar: PillarInstance | null;
    /** Current SDK state */
    state: Record<string, unknown>;
    /** Whether the SDK is ready */
    isReady: boolean;
    /** Whether the panel is currently open */
    isPanelOpen: boolean;
    /** Open the help panel */
    open: (options?: PillarOpenOptions) => void;
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

  export type UsePillarResult = PillarContextValue;

  /**
   * Extended result with type-safe onTask method.
   */

  export interface TypedUsePillarResult<TActions = any> extends Omit<
    PillarContextValue,
    "pillar"
  > {
    pillar: PillarContextValue["pillar"];
    /**
     * Type-safe task handler registration.
     *
     * @param taskName - The action name (autocompleted from your actions)
     * @param handler - Handler function with typed data parameter
     * @returns Unsubscribe function
     */
    onTask: <TName extends ActionNames<TActions>>(
      taskName: TName,
      handler: (data: ActionDataType<TActions, TName>) => void
    ) => () => void;
  }

  /**
   * Hook to access the Pillar SDK instance and state.
   *
   * @template TActions - Optional action definitions for type-safe onTask
   *
   * @example Basic usage
   * ```tsx
   * const { pillar, open, close } = usePillar();
   * ```
   *
   * @example Registering tools with usePillarTool (recommended)
   * ```tsx
   * import { usePillarTool } from '@pillar-ai/react';
   *
   * // Co-located metadata and handler
   * usePillarTool({
   *   name: 'add_to_cart',
   *   description: 'Add a product to the cart',
   *   execute: async ({ productId }) => {
   *     await cartApi.add(productId);
   *   },
   * });
   * ```
   */

  export function usePillar<TActions = any>(): TypedUsePillarResult<TActions>;

  // ============================================================================
  // usePillarContext hook
  // ============================================================================

  export function usePillarContext(): PillarContextValue;

  // ============================================================================
  // Tool types (unified tool schema)
  // ============================================================================

  export type ToolType =
    | "navigate"
    | "trigger_tool"
    | "trigger_action"
    | "inline_ui"
    | "external_link"
    | "copy_text"
    | "open_modal"
    | "fill_form"
    | "start_tutorial"
    | "query";

  export interface ToolExecuteResult {
    [key: string]: unknown;
  }

  export interface ToolSchema<TInput = Record<string, unknown>> {
    name: string;
    type?: ToolType;
    description: string;
    examples?: string[];
    autoRun?: boolean;
    autoComplete?: boolean;
    inputSchema?: Record<string, unknown>;
    execute: (input: TInput) => void | ToolExecuteResult | Promise<void | ToolExecuteResult>;
  }

  // ============================================================================
  // usePillarTool hook
  // ============================================================================

  /**
   * Register a single Pillar tool with co-located metadata and handler.
   */
  export function usePillarTool<TInput = Record<string, unknown>>(
    schema: ToolSchema<TInput>
  ): void;

  /**
   * Register multiple Pillar tools with co-located metadata and handlers.
   */
  export function usePillarTool(schemas: ToolSchema[]): void;

  /** @deprecated Use usePillarTool instead */
  export const usePillarAction: typeof usePillarTool;
}
