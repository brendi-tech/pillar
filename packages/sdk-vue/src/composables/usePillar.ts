/**
 * usePillar Composable
 * Access Pillar SDK instance and state with optional type-safe onTask
 */

import type {
  SyncActionDefinitions,
  ActionDefinitions,
  ActionDataType,
  ActionNames,
} from '@pillar-ai/sdk';
import { inject } from 'vue';
import { pillarContextKey } from '../context';
import type { PillarContextValue } from '../types';

export type UsePillarResult = PillarContextValue;

/**
 * Extended result with type-safe onTask method.
 *
 * @template TActions - The action definitions for type inference
 */
export interface TypedUsePillarResult<
  TActions extends SyncActionDefinitions | ActionDefinitions,
> extends Omit<PillarContextValue, 'pillar'> {
  pillar: PillarContextValue['pillar'];
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
 * Composable to access the Pillar SDK instance and state
 *
 * @example Basic usage (untyped)
 * ```vue
 * <script setup lang="ts">
 * import { usePillar } from '@pillar-ai/vue';
 *
 * const { isReady, open, close, isPanelOpen } = usePillar();
 * </script>
 *
 * <template>
 *   <div v-if="!isReady">Loading...</div>
 *   <button v-else @click="open()">
 *     {{ isPanelOpen ? 'Close Help' : 'Get Help' }}
 *   </button>
 * </template>
 * ```
 *
 * @example Type-safe onTask with action definitions
 * ```vue
 * <script setup lang="ts">
 * import { usePillar } from '@pillar-ai/vue';
 * import { actions } from '@/lib/pillar/actions';
 * import { onMounted, onUnmounted } from 'vue';
 *
 * const { pillar, onTask } = usePillar<typeof actions>();
 *
 * let unsub: (() => void) | undefined;
 *
 * onMounted(() => {
 *   // TypeScript knows data has { type, url, name }
 *   unsub = onTask('add_new_source', (data) => {
 *     console.log(data.url); // ✓ Typed!
 *   });
 * });
 *
 * onUnmounted(() => {
 *   unsub?.();
 * });
 * </script>
 * ```
 */
export function usePillar<
  TActions extends SyncActionDefinitions | ActionDefinitions = SyncActionDefinitions,
>(): TypedUsePillarResult<TActions> {
  const context = inject<PillarContextValue>(pillarContextKey);

  if (!context) {
    throw new Error('usePillar must be used within a PillarProvider');
  }

  // Create a type-safe wrapper around pillar.onTask
  const onTask = <TName extends ActionNames<TActions>>(
    taskName: TName,
    handler: (data: ActionDataType<TActions, TName>) => void
  ): (() => void) => {
    if (!context.pillar.value) {
      // Return no-op if pillar not ready
      return () => {};
    }
    // Cast handler to match the SDK's expected type
    // The runtime behavior is the same, this is just for type narrowing
    return context.pillar.value.onTask(
      taskName as string,
      handler as (data: Record<string, unknown>) => void
    );
  };

  return {
    ...context,
    onTask,
  };
}
