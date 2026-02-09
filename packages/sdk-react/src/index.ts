/**
 * @pillar-ai/react - React bindings for Pillar SDK
 * 
 * @example
 * ```tsx
 * import { PillarProvider, PillarPanel, usePillar, useHelpPanel } from '@pillar-ai/react';
 * 
 * function App() {
 *   return (
 *     <PillarProvider productKey="your-product-key">
 *       <MyApp />
 *     </PillarProvider>
 *   );
 * }
 * 
 * function MyApp() {
 *   const { isReady } = usePillar();
 *   const { toggle } = useHelpPanel();
 *   
 *   return (
 *     <div>
 *       <h1>Welcome!</h1>
 *       <button onClick={toggle}>Open Co-pilot</button>
 *     </div>
 *   );
 * }
 * 
 * // Custom panel placement example:
 * function AppWithCustomPanel() {
 *   return (
 *     <PillarProvider 
 *       productKey="your-product-key"
 *       config={{ panel: { container: 'manual' } }}
 *     >
 *       <div className="layout">
 *         <PillarPanel className="custom-panel" />
 *         <main>Your content</main>
 *       </div>
 *     </PillarProvider>
 *   );
 * }
 * ```
 */

// Provider
export {
    PillarProvider,
    usePillarContext,
    type PillarContextValue,
    type PillarProviderProps,
    type CardComponentProps,
    type CardComponent,
} from './PillarProvider';

// Components
export { PillarPanel, type PillarPanelProps } from './PillarPanel';

// Hooks
export { useHelpPanel, type UseHelpPanelResult } from './hooks/useHelpPanel';
export { usePillar, type UsePillarResult, type TypedUsePillarResult } from './hooks/usePillar';

// Re-export types from core SDK for convenience
export type {
    EdgeTriggerConfig,
    MobileTriggerConfig,
    MobileTriggerPosition,
    MobileTriggerIcon,
    MobileTriggerSize,
    PanelConfig,
    PillarConfig,
    PillarEvents,
    PillarState,
    ResolvedConfig,
    ResolvedMobileTriggerConfig,
    ResolvedThemeConfig,
    TaskExecutePayload,
    TextSelectionConfig,
    ThemeColors,
    ThemeConfig,
    ThemeMode,
    CardCallbacks,
    CardRenderer,
    SidebarTabConfig,
    // Action types for type-safe onTask
    ActionDefinitions,
    SyncActionDefinitions,
    ActionDataType,
    ActionNames,
    // Chat context for escalation
    ChatContext,
    // DOM Scanning types
    DOMScanningConfig,
    ResolvedDOMScanningConfig,
    ScanOptions,
    CompactScanResult,
    InteractionType,
    // DOM Scanner utilities
    scanPageDirect,
} from '@pillar-ai/sdk';

