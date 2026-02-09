/**
 * ChatInputPreview
 * A React component that replicates the SDK's UnifiedChatInput component.
 * Uses the same CSS classes as the real SDK for consistent styling.
 * Used for Remotion stills.
 */

import React from 'react';
import { CloseIcon } from './icons';

// Quote icon for context tags
const QuoteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
  </svg>
);

// Image upload icon (matches SDK)
const ImageIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// Arrow up icon for send button (matches SDK UnifiedChatInput)
const ArrowUpIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

export interface ContextItem {
  id: string;
  label: string;
}

export interface ChatInputPreviewProps {
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  contextItems?: ContextItem[];
  showImageUpload?: boolean;
}

export const ChatInputPreview: React.FC<ChatInputPreviewProps> = ({
  placeholder = 'Ask anything...',
  value = '',
  disabled = false,
  contextItems = [],
  showImageUpload = true,
}) => {
  const hasContext = contextItems.length > 0;
  const hasValue = value.length > 0;

  return (
    <div className="_pillar-unified-input-wrapper pillar-unified-input-wrapper">
      {/* Context tags */}
      {hasContext && (
        <div className="_pillar-context-tag-list">
          {contextItems.map((item) => (
            <div key={item.id} className="_pillar-context-tag">
              <span className="_pillar-context-tag-icon">
                <QuoteIcon />
              </span>
              <span className="_pillar-context-tag-label">{item.label}</span>
              <button
                className="_pillar-context-tag-remove"
                type="button"
                aria-label="Remove context"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="_pillar-unified-input pillar-unified-input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        readOnly
        rows={1}
        style={{ height: hasValue ? 'auto' : '41px' }}
      />

      <div className="_pillar-unified-input-row pillar-unified-input-row">
        {/* Image upload button */}
        {showImageUpload && (
          <button
            type="button"
            className="_pillar-chat-image-btn pillar-chat-image-btn"
            disabled={disabled}
            aria-label="Attach image"
            title="Attach image (max 4)"
          >
            <ImageIcon />
          </button>
        )}
        <button
          type="button"
          className="_pillar-unified-send-btn pillar-unified-send-btn"
          disabled={disabled}
          aria-label="Send message"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </div>
  );
};

export default ChatInputPreview;
