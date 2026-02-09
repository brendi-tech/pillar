/**
 * PillarService
 * Angular service that initializes and manages the Pillar SDK
 */

import {
  Injectable,
  NgZone,
  signal,
  computed,
  inject,
  createComponent,
  ApplicationRef,
  EnvironmentInjector,
  type Type,
} from '@angular/core';
import {
  Pillar,
  type CardCallbacks,
  type PillarConfig,
  type PillarEvents,
  type PillarState,
  type TaskExecutePayload,
  type ThemeConfig,
} from '@pillar-ai/sdk';
import type { CardComponent, PillarInitConfig } from './types';

@Injectable({ providedIn: 'root' })
export class PillarService {
  private readonly ngZone = inject(NgZone);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  // Internal state
  private readonly _pillar = signal<Pillar | null>(null);
  private readonly cleanupFns: Array<() => void> = [];
  private readonly cardRefs: Map<HTMLElement, any> = new Map();
  private onTaskCallback: ((task: TaskExecutePayload) => void) | null = null;
  private registeredCards: Record<string, CardComponent> | null = null;

  // Public signals
  readonly state = signal<PillarState>('uninitialized');
  readonly isReady = computed(() => this.state() === 'ready');
  readonly isPanelOpen = signal(false);

  /**
   * Get the Pillar SDK instance.
   */
  getInstance(): Pillar | null {
    return this._pillar();
  }

  /**
   * Initialize the Pillar SDK.
   * Call this in your app's initialization (e.g., APP_INITIALIZER).
   *
   * @param initConfig - Configuration options
   */
  async init(initConfig: PillarInitConfig): Promise<void> {
    const { productKey, helpCenter, config, onTask, cards } = initConfig;

    // Support both productKey (new) and helpCenter (deprecated)
    const resolvedKey = productKey ?? helpCenter;

    if (helpCenter && !productKey) {
      console.warn(
        '[Pillar Angular] "helpCenter" is deprecated. Use "productKey" instead.'
      );
    }

    // Store callbacks for later use
    this.onTaskCallback = onTask ?? null;
    this.registeredCards = cards ?? null;

    try {
      // Pillar is a singleton - check if already initialized
      const existingInstance = Pillar.getInstance();
      if (existingInstance) {
        // Reuse existing instance (preserves chat history, panel state, etc.)
        this._pillar.set(existingInstance);
        this.state.set(existingInstance.state);
        this.subscribeToEvents(existingInstance);
        this.registerCards(existingInstance);
        return;
      }

      // Initialize new instance
      const instance = await Pillar.init({
        productKey: resolvedKey,
        ...config,
      });

      this.ngZone.run(() => {
        this._pillar.set(instance);
        this.state.set(instance.state);
      });

      this.subscribeToEvents(instance);
      this.registerCards(instance);
    } catch (error) {
      console.error('[Pillar Angular] Failed to initialize:', error);
      this.ngZone.run(() => {
        this.state.set('error');
      });
      throw error;
    }
  }

  /**
   * Subscribe to SDK events and sync to Angular signals.
   */
  private subscribeToEvents(instance: Pillar): void {
    // Panel open/close events
    const unsubOpen = instance.on('panel:open', () => {
      this.ngZone.run(() => {
        this.isPanelOpen.set(true);
      });
    });
    this.cleanupFns.push(unsubOpen);

    const unsubClose = instance.on('panel:close', () => {
      this.ngZone.run(() => {
        this.isPanelOpen.set(false);
      });
    });
    this.cleanupFns.push(unsubClose);

    // State change events
    const unsubReady = instance.on('ready', () => {
      this.ngZone.run(() => {
        this.state.set('ready');
      });
    });
    this.cleanupFns.push(unsubReady);

    const unsubError = instance.on('error', () => {
      this.ngZone.run(() => {
        this.state.set('error');
      });
    });
    this.cleanupFns.push(unsubError);

    // Task execution events
    if (this.onTaskCallback) {
      const callback = this.onTaskCallback;
      const unsubTask = instance.on('task:execute', (task) => {
        this.ngZone.run(() => {
          callback(task);
        });
      });
      this.cleanupFns.push(unsubTask);
    }
  }

  /**
   * Register custom card components.
   */
  private registerCards(instance: Pillar): void {
    if (!this.registeredCards) return;

    Object.entries(this.registeredCards).forEach(([cardType, CardComponent]) => {
      const unsubscribe = instance.registerCard(
        cardType,
        (container, data, callbacks: CardCallbacks) => {
          // Create an Angular component dynamically
          const componentRef = createComponent(CardComponent as Type<any>, {
            environmentInjector: this.environmentInjector,
          });

          // Set inputs
          componentRef.setInput('data', data);
          componentRef.setInput('onConfirm', callbacks.onConfirm);
          componentRef.setInput('onCancel', callbacks.onCancel);
          componentRef.setInput('onStateChange', callbacks.onStateChange);

          // Attach to the application
          this.appRef.attachView(componentRef.hostView);

          // Append to container
          container.appendChild(componentRef.location.nativeElement);
          this.cardRefs.set(container, componentRef);

          // Return cleanup function
          return () => {
            const ref = this.cardRefs.get(container);
            if (ref) {
              this.appRef.detachView(ref.hostView);
              ref.destroy();
              this.cardRefs.delete(container);
            }
          };
        }
      );

      this.cleanupFns.push(unsubscribe);
    });
  }

  /**
   * Open the help panel.
   */
  open(options?: {
    view?: string;
    article?: string;
    search?: string;
    focusInput?: boolean;
  }): void {
    this._pillar()?.open(options);
  }

  /**
   * Close the help panel.
   */
  close(): void {
    this._pillar()?.close();
  }

  /**
   * Toggle the help panel.
   */
  toggle(): void {
    this._pillar()?.toggle();
  }

  /**
   * Open a specific article.
   */
  openArticle(slug: string): void {
    this._pillar()?.open({ article: slug });
  }

  /**
   * Open a specific category.
   */
  async openCategory(slug: string): Promise<void> {
    this._pillar()?.navigate('category', { slug });
  }

  /**
   * Perform a search.
   */
  search(query: string): void {
    this._pillar()?.open({ search: query });
  }

  /**
   * Navigate to a specific view.
   */
  navigate(view: string, params?: Record<string, string>): void {
    this._pillar()?.navigate(view, params);
  }

  /**
   * Update the panel theme at runtime.
   */
  setTheme(theme: Partial<ThemeConfig>): void {
    this._pillar()?.setTheme(theme);
  }

  /**
   * Enable or disable the text selection "Ask AI" popover.
   */
  setTextSelectionEnabled(enabled: boolean): void {
    this._pillar()?.setTextSelectionEnabled(enabled);
  }

  /**
   * Subscribe to SDK events.
   */
  on<K extends keyof PillarEvents>(
    event: K,
    callback: (data: PillarEvents[K]) => void
  ): () => void {
    const pillar = this._pillar();
    if (!pillar) {
      return () => {};
    }

    // Wrap callback to run in Angular zone
    const wrappedCallback = (data: PillarEvents[K]) => {
      this.ngZone.run(() => callback(data));
    };

    return pillar.on(event, wrappedCallback);
  }

  /**
   * Register a task handler.
   */
  onTask(
    taskName: string,
    handler: (data: Record<string, unknown>) => void
  ): () => void {
    const pillar = this._pillar();
    if (!pillar) {
      return () => {};
    }

    // Wrap handler to run in Angular zone
    const wrappedHandler = (data: Record<string, unknown>) => {
      this.ngZone.run(() => handler(data));
    };

    return pillar.onTask(taskName, wrappedHandler);
  }

  /**
   * Mount the panel to a specific container element.
   * Used for manual panel placement with PillarPanelComponent.
   */
  mountPanelTo(container: HTMLElement): void {
    this._pillar()?.mountPanelTo(container);
  }

  /**
   * Cleanup resources.
   * Note: We intentionally don't call Pillar.destroy() here to preserve
   * conversation history across route changes. Call Pillar.destroy()
   * explicitly if you need to fully reset the SDK.
   */
  ngOnDestroy(): void {
    // Run all cleanup functions
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns.length = 0;

    // Destroy all card component refs
    this.cardRefs.forEach((ref) => {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    });
    this.cardRefs.clear();
  }
}
