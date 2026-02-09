/**
 * PlanPreview
 * A React component that replicates the SDK's Plan step list.
 * Used for Remotion stills.
 */

import React from 'react';

export type PlanStepStatus = 'pending' | 'ready' | 'awaiting_result' | 'completed' | 'skipped' | 'failed';

export interface PlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
}

export interface PlanPreviewProps {
  steps: PlanStep[];
}

// Status icons as React components
const PendingIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const ReadyIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

const AwaitingIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const CompletedIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9,12 12,15 16,10" />
  </svg>
);

const getStatusIcon = (status: PlanStepStatus): React.ReactNode => {
  switch (status) {
    case 'completed':
      return <CompletedIcon />;
    case 'ready':
      return <ReadyIcon />;
    case 'awaiting_result':
      return <AwaitingIcon />;
    case 'pending':
    default:
      return <PendingIcon />;
  }
};

export const PlanPreview: React.FC<PlanPreviewProps> = ({ steps }) => {
  return (
    <div className="pillar-plan-steps">
      {steps.map((step) => (
        <div 
          key={step.id} 
          className={`pillar-plan-step pillar-plan-step--${step.status}`}
        >
          <div className="pillar-plan-step__icon">
            {getStatusIcon(step.status)}
          </div>
          <div className="pillar-plan-step__content">
            <div className="pillar-plan-step__description">{step.description}</div>
            {step.status === 'awaiting_result' && (
              <div className="pillar-plan-step__awaiting-container">
                <div className="pillar-plan-step__instruction-row">
                  <span className="pillar-plan-step__action-badge">In Progress</span>
                  <span className="pillar-plan-step__instruction">Confirm update in UI</span>
                </div>
                <button type="button" className="pillar-plan-step__done-btn">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlanPreview;
