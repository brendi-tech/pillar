/**
 * WireframeComposition — Wireframe-only Remotion Composition.
 * Renders only the right-hand wireframe animation (no PromptHeader, no StepTimeline).
 * Used with the hybrid layout where React components handle the prompt and steps.
 *
 * Square format (1080x1080) designed to sit in the right column of
 * the TechnicalShowcase React component.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "./constants";
import { getActiveStepIndex, getStepActivationFrames } from "./timing";
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

interface WireframeCompositionProps {
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

export const WireframeComposition: React.FC<WireframeCompositionProps> = ({
  demoId = "banking",
}) => {
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
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      {getWireframeComponent(demoId, activeStepIndex, stepActivationFrames)}
    </div>
  );
};

export default WireframeComposition;
