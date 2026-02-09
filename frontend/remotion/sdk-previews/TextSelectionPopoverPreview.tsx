/**
 * TextSelectionPopoverPreview
 * A React component that replicates the SDK's text selection "Ask AI" popover.
 * Used for Remotion stills.
 */

import React from 'react';

// Sparkle icon matching the SDK
const SparkleIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
  </svg>
);

export interface TextSelectionPopoverPreviewProps {
  label?: string;
}

export const TextSelectionPopoverPreview: React.FC<TextSelectionPopoverPreviewProps> = ({
  label = 'Ask AI',
}) => {
  return (
    <div className="pillar-text-selection-popover pillar-text-selection-popover--visible">
      <div className="pillar-text-selection-popover__content">
        <span className="pillar-text-selection-popover__icon">
          <SparkleIcon />
        </span>
        <span className="pillar-text-selection-popover__label">{label}</span>
      </div>
      <div className="pillar-text-selection-popover__arrow" />
    </div>
  );
};

export default TextSelectionPopoverPreview;
