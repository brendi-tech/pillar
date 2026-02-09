/**
 * EdgeTriggerStill
 * Renders just the Copilot button from the SDK EdgeTrigger.
 */

import React from 'react';
import { EdgeTriggerPreview } from '../sdk-previews';

// Single Copilot tab only
const copilotTab = {
  id: 'assistant',
  label: 'Copilot',
  icon: 'help' as const,
  enabled: true,
  order: 0,
};

export const EdgeTriggerStill: React.FC = () => {
  return (
    <div 
      className="pillar-root" 
      style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <EdgeTriggerPreview
        tabs={[copilotTab]}
        activeTab="assistant"
        position="right"
        panelOpen={true}
        height={120}
      />
    </div>
  );
};

export default EdgeTriggerStill;
