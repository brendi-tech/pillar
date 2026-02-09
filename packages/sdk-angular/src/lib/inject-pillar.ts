/**
 * injectPillar Function
 * Angular-idiomatic injection helper for accessing Pillar SDK
 */

import { inject } from '@angular/core';
import type {
  SyncActionDefinitions,
  ActionDefinitions,
  ActionDataType,
  ActionNames,
} from '@pillar-ai/sdk';
import { PillarService } from './pillar.service';

/**
 * Result type for injectPillar with type-safe onTask.
 *
 * @template TActions - The action definitions for type inference
 */
export interface InjectPillarResult<
  TActions extends SyncActionDefinitions | ActionDefinitions = SyncActionDefinitions,
> {
  /** Get the Pillar SDK instance */
  pillar: () => ReturnType<PillarService['getInstance']>;

  /** Current SDK state */
  state: PillarService['state'];

  /** Whether the SDK is ready */
  isReady: PillarService['isReady'];

  /** Whether the panel is currently open */
  isPanelOpen: PillarService['isPanelOpen'];

  /** Open the help panel */
  open: PillarService['open'];

  /** Close the help panel */
  close: PillarService['close'];

  /** Toggle the help panel */
  toggle: PillarService['toggle'];

  /** Open a specific article */
  openArticle: PillarService['openArticle'];

  /** Open a specific category */
  openCategory: PillarService['openCategory'];

  /** Perform a search */
  search: PillarService['search'];

  /** Navigate to a specific view */
  navigate: PillarService['navigate'];

  /** Update the panel theme at runtime */
  setTheme: PillarService['setTheme'];

  /** Enable or disable the text selection "Ask AI" popover */
  setTextSelectionEnabled: PillarService['setTextSelectionEnabled'];

  /** Subscribe to SDK events */
  on: PillarService['on'];

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
 * Angular injection function to access the Pillar SDK.
 * Use this in components, directives, or services to interact with Pillar.
 *
 * Must be called within an injection context (constructor, field initializer, or inject()).
 *
 * @example Basic usage (untyped)
 * ```typescript
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
 * ```
 *
 * @example Type-safe onTask with action definitions
 * ```typescript
 * import { actions } from '@/lib/pillar/actions';
 *
 * @Component({...})
 * export class MyComponent implements OnInit, OnDestroy {
 *   private pillar = injectPillar<typeof actions>();
 *   private unsubscribe?: () => void;
 *
 *   ngOnInit() {
 *     // TypeScript knows data has the correct shape
 *     this.unsubscribe = this.pillar.onTask('add_new_source', (data) => {
 *       console.log(data.url); // ✓ Typed!
 *     });
 *   }
 *
 *   ngOnDestroy() {
 *     this.unsubscribe?.();
 *   }
 * }
 * ```
 */
export function injectPillar<
  TActions extends SyncActionDefinitions | ActionDefinitions = SyncActionDefinitions,
>(): InjectPillarResult<TActions> {
  const service = inject(PillarService);

  // Create a type-safe wrapper around pillar.onTask
  const onTask = <TName extends ActionNames<TActions>>(
    taskName: TName,
    handler: (data: ActionDataType<TActions, TName>) => void
  ): (() => void) => {
    // Cast handler to match the SDK's expected type
    // The runtime behavior is the same, this is just for type narrowing
    return service.onTask(
      taskName as string,
      handler as (data: Record<string, unknown>) => void
    );
  };

  return {
    pillar: () => service.getInstance(),
    state: service.state,
    isReady: service.isReady,
    isPanelOpen: service.isPanelOpen,
    open: service.open.bind(service),
    close: service.close.bind(service),
    toggle: service.toggle.bind(service),
    openArticle: service.openArticle.bind(service),
    openCategory: service.openCategory.bind(service),
    search: service.search.bind(service),
    navigate: service.navigate.bind(service),
    setTheme: service.setTheme.bind(service),
    setTextSelectionEnabled: service.setTextSelectionEnabled.bind(service),
    on: service.on.bind(service),
    onTask,
  };
}
