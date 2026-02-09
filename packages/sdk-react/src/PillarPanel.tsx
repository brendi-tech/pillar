/**
 * PillarPanel Component
 * Renders the Pillar help panel at a custom location in the DOM
 */

import React, { useRef, useEffect, type CSSProperties, type HTMLAttributes } from 'react';
import { usePillarContext } from './PillarProvider';

export interface PillarPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Custom class name for the container */
  className?: string;
  
  /** Custom inline styles for the container */
  style?: CSSProperties;
}

/**
 * Renders the Pillar help panel at a custom location in the DOM.
 * Use this when you want to control where the panel is rendered instead of
 * having it automatically appended to document.body.
 * 
 * **Important**: When using this component, set `panel.container: 'manual'` in your
 * PillarProvider config to prevent automatic mounting.
 * 
 * @example
 * ```tsx
 * <PillarProvider 
 *   helpCenter="my-help" 
 *   publicKey="pk_xxx"
 *   config={{ panel: { container: 'manual' } }}
 * >
 *   <div className="my-layout">
 *     <Sidebar />
 *     <PillarPanel className="help-panel-container" />
 *     <MainContent />
 *   </div>
 * </PillarProvider>
 * ```
 */
export function PillarPanel({ 
  className, 
  style,
  ...props 
}: PillarPanelProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { pillar, isReady } = usePillarContext();
  const hasMounted = useRef(false);

  useEffect(() => {
    // Only mount once when SDK is ready and we have a container
    if (!isReady || !pillar || !containerRef.current || hasMounted.current) {
      return;
    }

    // Mount the panel into our container
    pillar.mountPanelTo(containerRef.current);
    hasMounted.current = true;

    // Cleanup is handled by Pillar.destroy() in the provider
  }, [isReady, pillar]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={style}
      data-pillar-panel-container=""
      {...props}
    />
  );
}

