/**
 * PanelChatStill
 * Renders the SDK Panel with ChatThread for Remotion screenshots.
 */

import React from 'react';
import { PanelPreview, ChatThreadPreview, ChatInputPreview } from '../sdk-previews';
import { mockMessages } from '../mock-data';

export const PanelChatStill: React.FC = () => {
  return (
    <div className="pillar-root" style={{ height: 'auto' }}>
      <PanelPreview
        title="Copilot"
        position="right"
        width={380}
        showHomeButton={true}
        showNewChatButton={true}
        showCloseButton={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ChatThreadPreview
            messages={mockMessages}
            showFeedbackButtons={true}
          />
          <div className="_pillar-chat-view-input-area pillar-chat-view-input-area">
            <ChatInputPreview placeholder="Ask a follow-up..." />
          </div>
        </div>
      </PanelPreview>
    </div>
  );
};

export default PanelChatStill;
