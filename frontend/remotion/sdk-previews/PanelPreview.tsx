/**
 * PanelPreview
 * A React component that replicates the SDK's panel container with header,
 * content area, and optional input.
 * Used for Remotion stills.
 */

import React from 'react';
import { CloseIcon, HomeIcon, NewChatIcon } from './icons';

export interface PanelPreviewProps {
  title?: string;
  position?: 'left' | 'right';
  width?: number;
  height?: number | 'auto';
  showHeader?: boolean;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showNewChatButton?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
}

export const PanelPreview: React.FC<PanelPreviewProps> = ({
  title = 'Help',
  position = 'right',
  width = 380,
  height = 'auto',
  showHeader = true,
  showBackButton = false,
  showHomeButton = false,
  showNewChatButton = true,
  showCloseButton = true,
  children,
}) => {
  const panelClassName = [
    '_pillar-panel',
    `_pillar-panel--${position}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div 
      className={panelClassName} 
      style={{ 
        width, 
        height,
        '--pillar-panel-width': `${width}px`,
      } as React.CSSProperties}
    >
      <div className="_pillar-panel-root">
        <div className="_pillar-panel-ui">
          {showHeader && (
            <div className="_pillar-header">
              <div className="_pillar-header-left">
                {showBackButton && (
                  <button className="_pillar-icon-btn" type="button" aria-label="Back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>
                )}
                {showHomeButton && (
                  <button className="_pillar-icon-btn" type="button" aria-label="Home">
                    <HomeIcon />
                  </button>
                )}
                <h1 className="_pillar-header-title">{title}</h1>
              </div>
              <div className="_pillar-header-right">
                {showNewChatButton && (
                  <button className="_pillar-icon-btn" type="button" aria-label="New chat">
                    <NewChatIcon />
                  </button>
                )}
                {showCloseButton && (
                  <button className="_pillar-icon-btn" type="button" aria-label="Close">
                    <CloseIcon />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="_pillar-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelPreview;
