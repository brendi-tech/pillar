/**
 * StepTimeline — Left column vertical stepper.
 * Driven by frame count to progress through grouped steps.
 * Each step has an actor label, description, and optional technical detail.
 */

import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { DemoStep, StepState } from "../types";
import { COLORS, STEPS_START_FRAME } from "../constants";
import { StepItem } from "./StepItem";

interface StepTimelineProps {
  steps: DemoStep[];
  /** Current active step index (-1 if none active yet) */
  activeStepIndex: number;
}

/**
 * Calculate the frame at which each step activates.
 * Returns an array of activation frames for each step.
 */
export function getStepActivationFrames(steps: DemoStep[]): number[] {
  const frames: number[] = [];
  let currentFrame = STEPS_START_FRAME;
  for (const step of steps) {
    frames.push(currentFrame);
    currentFrame += step.durationFrames;
  }
  return frames;
}

/**
 * Get the current active step index given the current frame and steps.
 */
export function getActiveStepIndex(
  frame: number,
  steps: DemoStep[]
): number {
  const activationFrames = getStepActivationFrames(steps);
  let activeIndex = -1;
  for (let i = 0; i < activationFrames.length; i++) {
    if (frame >= activationFrames[i]) {
      activeIndex = i;
    }
  }
  return activeIndex;
}

/**
 * Get the state of a step given its index and the current active index.
 */
function getStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

export const StepTimeline: React.FC<StepTimelineProps> = ({
  steps,
  activeStepIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activationFrames = getStepActivationFrames(steps);

  // Approximate height per step (bigger now with actor badges + detail)
  const stepHeight = 140;
  const totalHeight = steps.length * stepHeight;
  const lineProgress =
    activeStepIndex >= 0
      ? interpolate(
          activeStepIndex,
          [0, steps.length - 1],
          [0, totalHeight - stepHeight],
          { extrapolateRight: "clamp" }
        )
      : 0;

  const lineGrowth = spring({
    frame: frame - STEPS_START_FRAME,
    fps,
    config: { damping: 30, stiffness: 40, mass: 1 },
  });

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 0",
      }}
    >
      {/* Connecting line (background) */}
      <div
        style={{
          position: "absolute",
          left: 19, // center of 40px circle
          top: 28,
          bottom: 28,
          width: 2,
          backgroundColor: COLORS.pending.line,
          borderRadius: 1,
        }}
      />

      {/* Connecting line (progress) */}
      <div
        style={{
          position: "absolute",
          left: 19,
          top: 28,
          width: 2,
          height: `${lineProgress * lineGrowth}px`,
          backgroundColor: COLORS.completed.line,
          borderRadius: 1,
        }}
      />

      {/* Steps */}
      {steps.map((step, index) => (
        <StepItem
          key={index}
          step={step}
          state={getStepState(index, activeStepIndex)}
          activateFrame={activationFrames[index]}
          index={index}
        />
      ))}
    </div>
  );
};

export default StepTimeline;
