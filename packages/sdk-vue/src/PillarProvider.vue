<script lang="ts">
/**
 * PillarProvider
 * Vue component that initializes and manages the Pillar SDK
 */

import {
  Pillar,
  type CardCallbacks,
  type PillarConfig,
  type PillarEvents,
  type PillarState,
  type TaskExecutePayload,
  type ThemeConfig,
} from '@pillar-ai/sdk';
import {
  computed,
  createApp,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
  type App,
  type Component,
  type PropType,
} from 'vue';
import { pillarContextKey } from './context';
import type { CardComponent, PillarContextValue } from './types';

// ============================================================================
// Component
// ============================================================================

export default defineComponent({
  name: 'PillarProvider',

  props: {
    productKey: {
      type: String,
      default: undefined,
    },
    // @deprecated Use productKey instead
    helpCenter: {
      type: String,
      default: undefined,
    },
    config: {
      type: Object as PropType<Omit<PillarConfig, 'productKey' | 'helpCenter'>>,
      default: undefined,
    },
    onTask: {
      type: Function as PropType<(task: TaskExecutePayload) => void>,
      default: undefined,
    },
    cards: {
      type: Object as PropType<Record<string, CardComponent>>,
      default: undefined,
    },
  },

  setup(props, { slots }) {
    // Reactive state
    const pillar = shallowRef<Pillar | null>(null);
    const state = ref<PillarState>('uninitialized');
    const isPanelOpen = ref(false);

    // Support both productKey (new) and helpCenter (deprecated)
    const resolvedKey = computed(() => props.productKey ?? props.helpCenter);

    // Warn about deprecated helpCenter usage
    if (props.helpCenter && !props.productKey) {
      console.warn(
        '[Pillar Vue] "help-center" prop is deprecated. Use "product-key" instead.'
      );
    }

    // Computed
    const isReady = computed(() => state.value === 'ready');

    // Store cleanup functions
    const cleanupFunctions: Array<() => void> = [];
    const cardApps: Map<HTMLElement, App> = new Map();

    // Actions
    const open = (options?: {
      view?: string;
      article?: string;
      search?: string;
      focusInput?: boolean;
    }) => {
      pillar.value?.open(options);
    };

    const close = () => {
      pillar.value?.close();
    };

    const toggle = () => {
      pillar.value?.toggle();
    };

    const openArticle = (slug: string) => {
      pillar.value?.open({ article: slug });
    };

    const openCategory = async (slug: string) => {
      pillar.value?.navigate('category', { slug });
    };

    const search = (query: string) => {
      pillar.value?.open({ search: query });
    };

    const navigate = (view: string, params?: Record<string, string>) => {
      pillar.value?.navigate(view, params);
    };

    const setTheme = (theme: Partial<ThemeConfig>) => {
      pillar.value?.setTheme(theme);
    };

    const setTextSelectionEnabled = (enabled: boolean) => {
      pillar.value?.setTextSelectionEnabled(enabled);
    };

    const on = <K extends keyof PillarEvents>(
      event: K,
      callback: (data: PillarEvents[K]) => void
    ): (() => void) => {
      return pillar.value?.on(event, callback) ?? (() => {});
    };

    // Register card renderers
    const registerCards = (instance: Pillar) => {
      if (!props.cards) return;

      Object.entries(props.cards).forEach(([cardType, CardComponent]) => {
        const unsubscribe = instance.registerCard(
          cardType,
          (container, data, callbacks: CardCallbacks) => {
            // Create a Vue app for this card
            const app = createApp({
              render() {
                return h(CardComponent as Component, {
                  data,
                  onConfirm: callbacks.onConfirm,
                  onCancel: callbacks.onCancel,
                  onStateChange: callbacks.onStateChange,
                });
              },
            });

            cardApps.set(container, app);
            app.mount(container);

            // Return cleanup function
            return () => {
              const existingApp = cardApps.get(container);
              if (existingApp) {
                existingApp.unmount();
                cardApps.delete(container);
              }
            };
          }
        );

        cleanupFunctions.push(unsubscribe);
      });
    };

    // Initialize SDK
    onMounted(async () => {
      try {
        // Pillar is a singleton - check if already initialized
        const existingInstance = Pillar.getInstance();
        if (existingInstance) {
          // Reuse existing instance (preserves chat history, panel state, etc.)
          pillar.value = existingInstance;
          state.value = existingInstance.state;

          // Re-subscribe to events
          const unsubOpen = existingInstance.on('panel:open', () => {
            isPanelOpen.value = true;
          });
          cleanupFunctions.push(unsubOpen);

          const unsubClose = existingInstance.on('panel:close', () => {
            isPanelOpen.value = false;
          });
          cleanupFunctions.push(unsubClose);

          // Register cards
          registerCards(existingInstance);
          return;
        }

        // Initialize new instance
        const instance = await Pillar.init({
          productKey: resolvedKey.value,
          ...props.config,
        });

        pillar.value = instance;
        state.value = instance.state;

        // Listen for panel open/close
        const unsubOpen = instance.on('panel:open', () => {
          isPanelOpen.value = true;
        });
        cleanupFunctions.push(unsubOpen);

        const unsubClose = instance.on('panel:close', () => {
          isPanelOpen.value = false;
        });
        cleanupFunctions.push(unsubClose);

        // Listen for state changes
        const unsubReady = instance.on('ready', () => {
          state.value = 'ready';
        });
        cleanupFunctions.push(unsubReady);

        const unsubError = instance.on('error', () => {
          state.value = 'error';
        });
        cleanupFunctions.push(unsubError);

        // Register task handler
        if (props.onTask) {
          const unsubTask = instance.on('task:execute', (task) => {
            props.onTask?.(task);
          });
          cleanupFunctions.push(unsubTask);
        }

        // Register cards
        registerCards(instance);
      } catch (error) {
        console.error('[Pillar Vue] Failed to initialize:', error);
        state.value = 'error';
      }
    });

    // Watch for onTask prop changes
    watch(
      () => props.onTask,
      (newHandler, oldHandler) => {
        if (pillar.value && newHandler && newHandler !== oldHandler) {
          // Note: We can't easily unsubscribe the old handler here
          // The onTask prop should ideally be stable
          const unsubTask = pillar.value.on('task:execute', (task) => {
            newHandler(task);
          });
          cleanupFunctions.push(unsubTask);
        }
      }
    );

    // Cleanup
    onUnmounted(() => {
      // Run all cleanup functions
      cleanupFunctions.forEach((cleanup) => cleanup());
      cleanupFunctions.length = 0;

      // Unmount all card apps
      cardApps.forEach((app) => app.unmount());
      cardApps.clear();

      // Note: We intentionally don't call Pillar.destroy() here
      // The singleton persists to maintain state across route changes
    });

    // Provide context
    const contextValue: PillarContextValue = {
      pillar,
      state,
      isReady,
      isPanelOpen,
      open,
      close,
      toggle,
      openArticle,
      openCategory,
      search,
      navigate,
      setTheme,
      setTextSelectionEnabled,
      on,
    };

    provide(pillarContextKey, contextValue);

    // Render slot content
    return () => slots.default?.();
  },
});
</script>
