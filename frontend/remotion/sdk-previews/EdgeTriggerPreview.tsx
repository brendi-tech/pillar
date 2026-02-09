/**
 * EdgeTriggerPreview
 * A React component that replicates the SDK's EdgeTrigger appearance.
 * Used for Remotion stills.
 */

import React from 'react';
import { HelpIcon, SupportIcon } from './icons';

export interface EdgeTriggerTab {
  id: string;
  label: string;
  icon?: 'help' | 'support' | 'chat' | 'settings';
  enabled: boolean;
  order: number;
}

export interface EdgeTriggerPreviewProps {
  tabs: EdgeTriggerTab[];
  activeTab?: string;
  position?: 'left' | 'right';
  panelOpen?: boolean;
  height?: number;
}

const getIconComponent = (icon?: string): React.FC<{ className?: string }> => {
  switch (icon) {
    case 'support':
      return SupportIcon;
    case 'help':
    default:
      return HelpIcon;
  }
};

export const EdgeTriggerPreview: React.FC<EdgeTriggerPreviewProps> = ({
  tabs,
  activeTab,
  position = 'right',
  panelOpen = false,
  height = 700,
}) => {
  // Filter to enabled tabs and sort by order
  const enabledTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  const sidebarClassName = [
    'pillar-edge-sidebar',
    `pillar-edge-sidebar--${position}`,
    panelOpen && 'pillar-edge-sidebar--panel-open',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sidebarClassName} style={{ height }}>
      {enabledTabs.map((tab) => {
        const isActive = panelOpen && activeTab === tab.id;
        const buttonClassName = [
          'pillar-edge-trigger',
          isActive && 'pillar-edge-trigger--active',
        ]
          .filter(Boolean)
          .join(' ');

        const IconComponent = getIconComponent(tab.icon);

        return (
          <button
            key={tab.id}
            className={buttonClassName}
            aria-label={tab.label || 'Help'}
            type="button"
          >
            <span className="pillar-edge-trigger__icon">
              <IconComponent />
            </span>
            <span className="pillar-edge-trigger__label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default EdgeTriggerPreview;
