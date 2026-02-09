<script lang="ts">
/**
 * PillarPanel Component
 * Renders the Pillar help panel at a custom location in the DOM
 */

import { defineComponent, inject, onMounted, ref, type PropType, type CSSProperties } from 'vue';
import { pillarContextKey } from './context';
import type { PillarContextValue } from './types';

/**
 * Renders the Pillar help panel at a custom location in the DOM.
 * Use this when you want to control where the panel is rendered instead of
 * having it automatically appended to document.body.
 * 
 * **Important**: When using this component, set `panel.container: 'manual'` in your
 * PillarProvider config to prevent automatic mounting.
 * 
 * @example
 * ```vue
 * <PillarProvider 
 *   help-center="my-help" 
 *   :config="{ panel: { container: 'manual' } }"
 * >
 *   <div class="my-layout">
 *     <Sidebar />
 *     <PillarPanel class="help-panel-container" />
 *     <MainContent />
 *   </div>
 * </PillarProvider>
 * ```
 */
export default defineComponent({
  name: 'PillarPanel',

  props: {
    class: {
      type: [String, Array, Object] as PropType<string | string[] | Record<string, boolean>>,
      default: undefined,
    },
    style: {
      type: Object as PropType<CSSProperties>,
      default: undefined,
    },
  },

  setup(props) {
    const containerRef = ref<HTMLDivElement | null>(null);
    const hasMounted = ref(false);
    
    // Inject context from PillarProvider
    const context = inject<PillarContextValue>(pillarContextKey);
    
    if (!context) {
      console.error('[Pillar Vue] PillarPanel must be used within a PillarProvider');
    }

    onMounted(() => {
      // Only mount once when SDK is ready and we have a container
      if (!context?.isReady.value || !context?.pillar.value || !containerRef.value || hasMounted.value) {
        // If not ready yet, watch for ready state
        if (context && !context.isReady.value) {
          const unwatch = context.on('ready', () => {
            if (containerRef.value && context.pillar.value && !hasMounted.value) {
              context.pillar.value.mountPanelTo(containerRef.value);
              hasMounted.value = true;
            }
          });
          // Note: cleanup is handled by Vue's reactivity system when component unmounts
        }
        return;
      }

      // Mount the panel into our container
      context.pillar.value.mountPanelTo(containerRef.value);
      hasMounted.value = true;

      // Cleanup is handled by Pillar.destroy() in the provider
    });

    return {
      containerRef,
      props,
    };
  },
});
</script>

<template>
  <div 
    ref="containerRef" 
    :class="props.class"
    :style="props.style"
    data-pillar-panel-container
  />
</template>
