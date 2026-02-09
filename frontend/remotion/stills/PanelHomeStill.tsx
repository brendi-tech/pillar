/**
 * PanelHomeStill
 * Renders the SDK Panel with HomeView for Remotion screenshots.
 */

import React from 'react';
import { PanelPreview, HomeViewPreview, ChatInputPreview } from '../sdk-previews';
import { mockQuestions, mockHomeConfig } from '../mock-data';

export const PanelHomeStill: React.FC = () => {
  return (
    <div className="pillar-root" style={{ height: 'auto' }}>
      <PanelPreview
        title="Copilot"
        position="right"
        width={380}
        showNewChatButton={true}
        showCloseButton={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 20px 20px' }}>
          <HomeViewPreview
            icon={mockHomeConfig.icon}
            title={mockHomeConfig.title}
            questions={mockQuestions}
          />
          <div style={{ marginTop: '16px' }}>
            <ChatInputPreview placeholder="Ask anything..." />
          </div>
        </div>
      </PanelPreview>
    </div>
  );
};

export default PanelHomeStill;
