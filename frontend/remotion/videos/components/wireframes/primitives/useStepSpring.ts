/**
 * useStepSpring — Shared hook for step-driven spring animations in wireframes.
 *
 * Returns a function that creates a Remotion spring tied to a specific step's
 * activation frame, with an optional delay. Uses the same spring config
 * (damping: 18, stiffness: 100, mass: 0.8) across all wireframe videos.
 */

import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const SPRING_CONFIG = { damping: 18, stiffness: 100, mass: 0.8 } as const;

export function useStepSpring(stepActivationFrames: number[]) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (stepIdx: number, delay = 0) =>
    spring({
      frame: frame - (stepActivationFrames[stepIdx] || 0) - delay,
      fps,
      config: SPRING_CONFIG,
    });
}
