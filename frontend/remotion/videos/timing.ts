/**
 * Shared timing utilities for demo step progression.
 *
 * These are pure functions with no Remotion dependency so they can be
 * used both inside Remotion compositions (frame-based) and in React
 * components on the marketing page (video-time-based).
 */

import type { DemoStep, StepState } from "./types";
import { STEPS_START_FRAME, COMPLETION_HOLD_FRAMES } from "./constants";

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
 * Returns -1 if no step is active yet (before STEPS_START_FRAME).
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
 * Compute the total composition duration in frames for a set of steps.
 * Includes the prompt intro, all steps, and a hold at the end.
 */
export function getTotalDurationFrames(steps: DemoStep[]): number {
  const totalStepFrames = steps.reduce((sum, s) => sum + s.durationFrames, 0);
  return STEPS_START_FRAME + totalStepFrames + COMPLETION_HOLD_FRAMES;
}

/**
 * Get the state of a step given its index and the current active index.
 */
export function getStepState(
  stepIndex: number,
  activeIndex: number
): StepState {
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}
