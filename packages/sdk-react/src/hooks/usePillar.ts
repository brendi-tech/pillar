/**
 * usePillar Hook
 * Access Pillar SDK instance and state with optional type-safe onTask
 */

import type {
  SyncActionDefinitions,
  ActionDefinitions,
  ActionDataType,
  ActionNames,
} from '@pillar-ai/sdk';
import { useCallback } from 'react';
import { usePillarContext, type PillarContextValue } from '../PillarProvider';

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
 * Hook to access the Pillar SDK instance and state
 *
 * @example Basic usage (untyped)
 * ```tsx
 * function MyComponent() {
 *   const { isReady, open, close, isPanelOpen } = usePillar();
 *
 *   if (!isReady) return <div>Loading...</div>;
 *
 *   return (
 *     <button onClick={() => open()}>
 *       {isPanelOpen ? 'Close Help' : 'Get Help'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Type-safe onTask with action definitions
 * ```tsx
 * import { actions } from '@/lib/pillar/actions';
 *
 * function MyComponent() {
 *   const { pillar, onTask } = usePillar<typeof actions>();
 *
 *   useEffect(() => {
 *     // TypeScript knows data has { type, url, name }
 *     const unsub = onTask('add_new_source', (data) => {
 *       console.log(data.url); // ✓ Typed!
 *     });
 *     return unsub;
 *   }, [onTask]);
 * }
 * ```
 */
export function usePillar<
  TActions extends SyncActionDefinitions | ActionDefinitions = SyncActionDefinitions,
>(): TypedUsePillarResult<TActions> {
  const context = usePillarContext();

  // Create a type-safe wrapper around pillar.onTask
  const onTask = useCallback(
    <TName extends ActionNames<TActions>>(
      taskName: TName,
      handler: (data: ActionDataType<TActions, TName>) => void
    ): (() => void) => {
      if (!context.pillar) {
        // Return no-op if pillar not ready
        return () => {};
      }
      // Cast handler to match the SDK's expected type
      // The runtime behavior is the same, this is just for type narrowing
      return context.pillar.onTask(
        taskName as string,
        handler as (data: Record<string, unknown>) => void
      );
    },
    [context.pillar]
  );

  return {
    ...context,
    onTask,
  };
}

