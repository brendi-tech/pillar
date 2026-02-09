/**
 * ChatInputStill
 * Renders the SDK unified chat input with context tags for Remotion screenshots.
 */

import React from 'react';
import { ChatInputPreview } from '../sdk-previews';
import { mockContextItems } from '../mock-data';

export const ChatInputStill: React.FC = () => {
  return (
    <div 
      className="pillar-root" 
      style={{ 
        padding: '24px 24px 32px 24px', 
        background: '#ffffff',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <ChatInputPreview 
        placeholder="Ask anything..." 
        value="What does this error mean?"
        contextItems={mockContextItems}
        showImageUpload={true}
      />
    </div>
  );
};

export default ChatInputStill;
