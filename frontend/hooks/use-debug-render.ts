/**
 * Hook to track component renders for debugging.
 * 
 * Usage:
 *   function MyComponent() {
 *     useDebugRender('MyComponent');
 *     // or with dependencies to track what changed:
 *     useDebugRender('MyComponent', { prop1, prop2, state1 });
 *   }
 */

import { useEffect, useRef } from 'react';
import { debug } from '@/lib/debug';

/**
 * Track component renders and optionally log what changed.
 * Only active when debugging is enabled.
 */
export function useDebugRender(
  componentName: string, 
  props?: Record<string, unknown>
): void {
  const prevPropsRef = useRef<Record<string, unknown> | undefined>(undefined);
  const renderCountRef = useRef(0);

  // Track render
  renderCountRef.current++;
  debug.renderCount(componentName);

  // If props provided, diff them to show what changed
  useEffect(() => {
    if (!debug.isEnabled() || !props) return;

    const prevProps = prevPropsRef.current;
    if (prevProps) {
      const changedProps: string[] = [];
      
      // Check for changed props
      Object.keys(props).forEach(key => {
        if (prevProps[key] !== props[key]) {
          changedProps.push(key);
        }
      });

      // Check for removed props
      Object.keys(prevProps).forEach(key => {
        if (!(key in props)) {
          changedProps.push(`-${key}`);
        }
      });

      if (changedProps.length > 0) {
        debug.log('render', `${componentName} changed props: [${changedProps.join(', ')}]`);
      }
    }

    prevPropsRef.current = { ...props };
  });
}

/**
 * Track effect execution for debugging.
 * 
 * Usage:
 *   useDebugEffect('fetchUser', () => {
 *     // effect code
 *   }, [userId]);
 */
export function useDebugEffect(
  effectName: string,
  effect: () => void | (() => void),
  deps?: React.DependencyList
): void {
  const prevDepsRef = useRef<React.DependencyList | undefined>(undefined);

  useEffect(() => {
    if (debug.isEnabled()) {
      const prevDeps = prevDepsRef.current;
      if (prevDeps && deps) {
        const changedIndices = deps
          .map((dep, i) => (prevDeps[i] !== dep ? i : -1))
          .filter(i => i !== -1);
        
        if (changedIndices.length > 0) {
          debug.log('render', `Effect "${effectName}" triggered by deps at indices: [${changedIndices.join(', ')}]`);
        }
      } else {
        debug.log('render', `Effect "${effectName}" triggered (first run)`);
      }
      prevDepsRef.current = deps;
    }

    debug.time('render', `effect:${effectName}`);
    const cleanup = effect();
    debug.timeEnd('render', `effect:${effectName}`);
    
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

