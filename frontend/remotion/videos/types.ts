/**
 * Types for Remotion technical demo video compositions.
 */

/** Who is acting in this step */
export type StepActor = "user" | "pillar" | "app" | "done";

/** State of a step during animation */
export type StepState = "pending" | "active" | "completed";

/** A single grouped step in a demo sequence */
export interface DemoStep {
  /** Actor performing this step */
  actor: StepActor;
  /** Display label shown above the description */
  label: string;
  /** Main description — can be multi-line for grouped actions */
  description: string;
  /** Optional technical detail shown below (e.g. tool calls, API signatures) */
  detail?: string;
  /** How many frames this step stays active */
  durationFrames: number;
}

/** Full configuration for a demo video */
export interface DemoConfig {
  /** Demo identifier, matches chatExamples id */
  id: string;
  /** The user prompt shown at top, e.g. "Send $200 to my cleaner" */
  prompt: string;
  /** Ordered list of steps */
  steps: DemoStep[];
}
