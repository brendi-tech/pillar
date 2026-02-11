/**
 * DemoComposition — Main Remotion Composition for technical demo videos.
 * Two-column layout: StepTimeline (left) + Wireframe (right).
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, LEFT_COLUMN_WIDTH, PADDING } from "./constants";
import { PromptHeader } from "./components/PromptHeader";
import { StepTimeline, getActiveStepIndex } from "./components/StepTimeline";
import { getStepActivationFrames } from "./components/StepTimeline";
import type { DemoConfig } from "./types";

// Demo data imports
import { bankingDemo } from "./data/banking";
import { crmDemo } from "./data/crm";
import { analyticsDemo } from "./data/analytics";
import { pmDemo } from "./data/pm";
import { hrDemo } from "./data/hr";

// Wireframe imports
import { BankingWireframe } from "./components/wireframes/BankingWireframe";
import { CRMWireframe } from "./components/wireframes/CRMWireframe";
import { AnalyticsWireframe } from "./components/wireframes/AnalyticsWireframe";
import { PMWireframe } from "./components/wireframes/PMWireframe";
import { HRWireframe } from "./components/wireframes/HRWireframe";

const DEMO_CONFIGS: Record<string, DemoConfig> = {
  banking: bankingDemo,
  crm: crmDemo,
  analytics: analyticsDemo,
  pm: pmDemo,
  hr: hrDemo,
};

interface DemoCompositionProps {
  demoId?: string;
}

function getWireframeComponent(
  demoId: string,
  activeStepIndex: number,
  stepActivationFrames: number[]
): React.ReactNode {
  const props = { activeStepIndex, stepActivationFrames };

  switch (demoId) {
    case "banking":
      return <BankingWireframe {...props} />;
    case "crm":
      return <CRMWireframe {...props} />;
    case "analytics":
      return <AnalyticsWireframe {...props} />;
    case "pm":
      return <PMWireframe {...props} />;
    case "hr":
      return <HRWireframe {...props} />;
    default:
      return <BankingWireframe {...props} />;
  }
}

export const DemoComposition: React.FC<DemoCompositionProps> = ({ demoId = "banking" }) => {
  const frame = useCurrentFrame();
  const config = DEMO_CONFIGS[demoId] || bankingDemo;
  const activeStepIndex = getActiveStepIndex(frame, config.steps);
  const stepActivationFrames = getStepActivationFrames(config.steps);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        padding: PADDING,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      {/* Prompt Header */}
      <PromptHeader prompt={config.prompt} />

      {/* Two-column layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 40,
          marginTop: 32,
          minHeight: 0,
        }}
      >
        {/* Left column: Step Timeline */}
        <div
          style={{
            width: LEFT_COLUMN_WIDTH,
            flexShrink: 0,
            overflowY: "hidden",
          }}
        >
          <StepTimeline
            steps={config.steps}
            activeStepIndex={activeStepIndex}
          />
        </div>

        {/* Right column: Wireframe */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {getWireframeComponent(demoId, activeStepIndex, stepActivationFrames)}
        </div>
      </div>
    </div>
  );
};

export default DemoComposition;
