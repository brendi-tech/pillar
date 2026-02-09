/**
 * PanelPlanStill
 * Renders the SDK Panel with a conversation showing a half-completed Plan.
 * Uses the CRM example: closing a deal in Salesforce.
 */

import React from 'react';
import { PanelPreview, PlanPreview } from '../sdk-previews';
import { mockPlanSteps, mockPlanUserMessage } from '../mock-data';

export const PanelPlanStill: React.FC = () => {
  return (
    <div className="pillar-root" style={{ height: '100%' }}>
      <PanelPreview
        title="Copilot"
        position="right"
        width={380}
        height={620}
        showHomeButton={true}
        showNewChatButton={true}
        showCloseButton={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* User message */}
          <div style={{ padding: '20px 20px 12px' }}>
            <div className="_pillar-chat-view-message _pillar-chat-view-message--user">
              <div className="_pillar-message-user">{mockPlanUserMessage}</div>
            </div>
          </div>

          {/* Assistant intro message */}
          <div style={{ padding: '0 20px 16px' }}>
            <div className="_pillar-message-assistant-wrapper">
              <div className="_pillar-message-assistant">
                <p>I'll help you close this deal. Here's what we'll do:</p>
              </div>
            </div>
          </div>

          {/* Plan checklist */}
          <PlanPreview steps={mockPlanSteps} />
        </div>
      </PanelPreview>
    </div>
  );
};

export default PanelPlanStill;
