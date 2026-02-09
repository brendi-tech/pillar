/**
 * TextSelectionStill
 * Renders the "Ask AI" popover that appears when selecting text.
 */

import React from 'react';
import { TextSelectionPopoverPreview } from '../sdk-previews';

export const TextSelectionStill: React.FC = () => {
  return (
    <div 
      className="pillar-root" 
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 24px 24px',
        background: '#ffffff',
      }}
    >
      <TextSelectionPopoverPreview label="Ask AI" />
      {/* Simulated highlighted text below the popover */}
      <div
        style={{
          marginTop: '8px',
          padding: '2px 0',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '13px',
          lineHeight: '1.5',
          color: '#dc2626',
          background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.25))',
          borderRadius: '2px',
        }}
      >
        Error: Cannot read property 'id' of undefined
      </div>
    </div>
  );
};

export default TextSelectionStill;
