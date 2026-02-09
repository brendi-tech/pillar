/**
 * HomeViewPreview
 * A React component that replicates the SDK's home view with welcome message
 * and suggested question chips.
 * Used for Remotion stills.
 */

import React from 'react';

export interface SuggestedQuestion {
  id: string;
  text: string;
}

export interface HomeViewPreviewProps {
  icon?: string;
  title?: string;
  questions: SuggestedQuestion[];
}

export const HomeViewPreview: React.FC<HomeViewPreviewProps> = ({
  icon = '💬',
  title = 'How can I help?',
  questions,
}) => {
  return (
    <div className="_pillar-home-view">
      <div className="_pillar-home-view-header">
        <div className="_pillar-home-view-icon">{icon}</div>
        <h2 className="_pillar-home-view-title">{title}</h2>
      </div>
      <div className="_pillar-home-view-questions">
        {questions.map((question) => (
          <button
            key={question.id}
            className="_pillar-question-chip"
            type="button"
          >
            <span className="_pillar-question-chip-text">{question.text}</span>
            <span className="_pillar-question-chip-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomeViewPreview;
