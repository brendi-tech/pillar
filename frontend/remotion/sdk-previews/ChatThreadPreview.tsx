/**
 * ChatThreadPreview
 * A React component that replicates the SDK's chat message thread appearance.
 * Used for Remotion stills.
 */

import React from 'react';
import { ThumbsUpIcon, ThumbsDownIcon } from './icons';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  showFeedback?: boolean;
}

export interface ChatThreadPreviewProps {
  messages: ChatMessage[];
  showFeedbackButtons?: boolean;
}

export const ChatThreadPreview: React.FC<ChatThreadPreviewProps> = ({
  messages,
  showFeedbackButtons = true,
}) => {
  return (
    <div className="_pillar-chat-view-messages">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`_pillar-chat-view-message _pillar-chat-view-message--${message.role}`}
        >
          {message.role === 'user' ? (
            <div className="_pillar-message-user">{message.content}</div>
          ) : (
            <div className="_pillar-message-assistant-wrapper">
              <div className="_pillar-message-assistant-content">
                <div className="_pillar-message-assistant">
                  {/* Render content as paragraphs */}
                  {message.content.split('\n\n').map((paragraph, pIndex) => (
                    <p key={pIndex}>{paragraph}</p>
                  ))}
                </div>
              </div>
              {showFeedbackButtons && (message.showFeedback !== false) && (
                <div className="_pillar-feedback-icons">
                  <button className="_pillar-feedback-btn" type="button" aria-label="Helpful">
                    <ThumbsUpIcon />
                  </button>
                  <button className="_pillar-feedback-btn" type="button" aria-label="Not helpful">
                    <ThumbsDownIcon />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChatThreadPreview;
