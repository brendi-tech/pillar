/**
 * @pillar-ai/angular - Angular bindings for Pillar SDK
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
 * import { PillarService } from '@pillar-ai/angular';
 *
 * function initPillar() {
 *   const pillar = inject(PillarService);
 *   return () => pillar.init({ productKey: 'your-product-key' });
 * }
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     { provide: APP_INITIALIZER, useFactory: initPillar, multi: true },
 *   ],
 * };
 *
 * // help-button.component.ts
 * import { Component } from '@angular/core';
 * import { injectPillar } from '@pillar-ai/angular';
 *
 * @Component({
 *   selector: 'app-help-button',
 *   standalone: true,
 *   template: `
 *     <button (click)="toggle()">
 *       {{ isPanelOpen() ? 'Close Help' : 'Get Help' }}
 *     </button>
 *   `,
 * })
 * export class HelpButtonComponent {
 *   private pillar = injectPillar();
 *   isPanelOpen = this.pillar.isPanelOpen;
 *   toggle = this.pillar.toggle;
 * }
 *
 * // Custom panel placement example:
 * // layout.component.ts
 * import { Component } from '@angular/core';
 * import { PillarPanelComponent } from '@pillar-ai/angular';
 *
 * @Component({
 *   selector: 'app-layout',
 *   standalone: true,
 *   imports: [PillarPanelComponent],
 *   template: `
 *     <div class="layout">
 *       <pillar-panel class="custom-panel" />
 *       <main>Your content</main>
 *     </div>
 *   `,
 * })
 * export class LayoutComponent {}
 * ```
 */

// Service
export { PillarService } from './lib/pillar.service';

// Components
export { PillarPanelComponent } from './lib/pillar-panel.component';

// Inject functions
export { injectPillar, type InjectPillarResult } from './lib/inject-pillar';
export { injectHelpPanel } from './lib/inject-help-panel';

// Types
export type {
  CardComponent,
  CardComponentProps,
  PillarContextValue,
  PillarInitConfig,
  PillarServiceActions,
  PillarServiceState,
  InjectHelpPanelResult,
} from './lib/types';

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
} from '@pillar-ai/sdk';
