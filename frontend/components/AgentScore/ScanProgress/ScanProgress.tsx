"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailSubscribe } from "@/components/AgentScore/ScoreReport/EmailSubscribe";
import type { AgentScoreReport, ScanProgress as ScanProgressData, LayerState } from "../AgentScore.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanProgressProps {
  /** Timestamp (ms) when scanning started. */
  startedAt: number;
  /** Polled report data — drives real step completion. */
  report?: AgentScoreReport | null;
}

type StepStatus = "waiting" | "active" | "done";

/**
 * Each step has a `progressKey` that maps to a boolean in the backend
 * `progress` object, plus a visual stagger so steps don't all flip at once.
 */
interface ProgressStep {
  label: string;
  /** Key into `report.progress` that marks this step done. */
  progressKey: keyof ScanProgressData;
  /** Minimum seconds the step must be "active" before it can flip to "done".
   *  Prevents the checkmark from appearing instantly when the first poll
   *  already has the step complete. */
  minActiveSecs: number;
  /** If true, this step can be hidden (e.g. signup test when not enabled). */
  hideable?: boolean;
  /** Identifies which feature gate controls visibility: "signup" or "openclaw". */
  hideKey?: "signup" | "openclaw";
  /** If true, this step starts "active" immediately (runs in parallel with
   *  the other layers, not sequentially after previous steps). */
  parallel?: boolean;
}

const STEPS: ProgressStep[] = [
  { label: "Fetching page...", progressKey: "http_probes_done", minActiveSecs: 1.5 },
  { label: "Checking robots.txt, sitemap, llms.txt...", progressKey: "http_probes_done", minActiveSecs: 3 },
  { label: "Running browser analysis...", progressKey: "browser_analysis_done", minActiveSecs: 1.5 },
  { label: "Testing agent signup...", progressKey: "signup_test_done", minActiveSecs: 1.5, hideable: true, parallel: true, hideKey: "signup" },
  { label: "Testing with OpenClaw agent...", progressKey: "openclaw_test_done", minActiveSecs: 1.5, hideable: true, parallel: true, hideKey: "openclaw" },
  { label: "Analyzing & scoring...", progressKey: "scoring_done", minActiveSecs: 1.5 },
];

// ---------------------------------------------------------------------------
// Status logic
// ---------------------------------------------------------------------------

/**
 * Determine the visual status of a step.
 *
 * Sequential steps become "active" when all previous steps are done.
 * Parallel steps (like signup test) become "active" immediately alongside
 * step 0 — they run concurrently with the other layers.
 * Step 0 is always active immediately.
 * A step becomes "done" when the backend says so AND it has been active for
 * at least `minActiveSecs`.
 */
function getStepStatus(
  stepIndex: number,
  steps: ProgressStep[],
  progress: ScanProgressData | undefined,
  activeTimestamps: Record<string, number>,
  now: number,
): StepStatus {
  const step = steps[stepIndex];

  // Without progress data yet (first poll hasn't returned), step 0 and
  // parallel steps are active, the rest wait.
  if (!progress) {
    return stepIndex === 0 || step.parallel ? "active" : "waiting";
  }

  const backendDone = progress[step.progressKey];

  // Parallel steps are always at least "active" (they start immediately)
  if (step.parallel) {
    const activeAt = activeTimestamps[step.label];
    if (backendDone && activeAt !== undefined) {
      const activeDuration = (now - activeAt) / 1000;
      if (activeDuration >= step.minActiveSecs) {
        return "done";
      }
    }
    return "active";
  }

  // Sequential steps: check if all previous non-parallel steps are done,
  // and all parallel steps are also done.
  const allPreviousDone =
    stepIndex === 0 ||
    steps.slice(0, stepIndex).every((prev) => progress[prev.progressKey]);

  if (!allPreviousDone) return "waiting";

  // This step's prerequisites are met — it should be at least "active"
  const activeAt = activeTimestamps[step.label];

  if (backendDone && activeAt !== undefined) {
    const activeDuration = (now - activeAt) / 1000;
    if (activeDuration >= step.minActiveSecs) {
      return "done";
    }
  }

  return "active";
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="h-5 w-5 rounded-full bg-[#0CCE6B] flex items-center justify-center shrink-0">
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === "active") {
    return <Loader2 className="h-5 w-5 text-[#FF6E00] animate-spin shrink-0" />;
  }
  return <Circle className="h-5 w-5 text-[#D4D4D4] shrink-0" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanProgress({ startedAt, report }: ScanProgressProps) {
  const [now, setNow] = useState(Date.now());
  // Track when each step first became "active" so we can enforce minActiveSecs.
  // Keyed by step label for stable lookups regardless of array index changes.
  const activeTimestamps = useRef<Record<string, number>>({});

  // Tick every 500ms to re-evaluate visual stagger timers.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // All steps are always visible — both tests always run.
  const visibleSteps = STEPS;

  const progress = report?.progress;

  // Compute statuses and record activation timestamps
  const statuses = visibleSteps.map((step, i) => {
    const status = getStepStatus(i, visibleSteps, progress, activeTimestamps.current, now);

    // Record the first time a step becomes active
    if (status === "active" && activeTimestamps.current[step.label] === undefined) {
      activeTimestamps.current[step.label] = now;
    }
    // Step 0 and parallel steps are active from mount
    if ((i === 0 || step.parallel) && activeTimestamps.current[step.label] === undefined) {
      activeTimestamps.current[step.label] = startedAt;
    }

    return status;
  });

  return (
    <div className="bg-white border border-[#D4D4D4] rounded-xl p-6 sm:p-8 mt-8">
      <div className="space-y-4">
        {visibleSteps.map((step, i) => {
          const status = statuses[i];

          // Resolve the layer state enum for parallel (optional) steps
          let layerState: LayerState | undefined;
          if (step.progressKey === "signup_test_done") layerState = progress?.signup_test_state;
          else if (step.progressKey === "openclaw_test_done") layerState = progress?.openclaw_test_state;

          // Show granular substatus for signup/openclaw while running
          let substatus: string | undefined;
          if (layerState === "running") {
            if (step.progressKey === "signup_test_done") substatus = progress?.signup_test_status;
            else if (step.progressKey === "openclaw_test_done") substatus = progress?.openclaw_test_status;
          }

          // A parallel step that errored is visually "done" but should say "Failed"
          const stepErrored = status === "done" && layerState === "error";

          return (
            <div
              key={step.label}
              className={cn(
                "flex items-start gap-3 transition-opacity duration-500",
                status === "waiting" && "opacity-40"
              )}
            >
              <StepIcon status={stepErrored ? "done" : status} />
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    status === "done" && "text-[#1A1A1A]",
                    status === "active" && "text-[#1A1A1A]",
                    status === "waiting" && "text-[#6B6B6B]"
                  )}
                >
                  {step.label}
                </span>
                {substatus && (
                  <p className="text-xs text-[#6B6B6B] mt-0.5 animate-in fade-in duration-300">
                    {substatus}
                  </p>
                )}
              </div>
              <span className="ml-auto text-xs text-[#6B6B6B] shrink-0 pt-0.5">
                {status === "done" && (stepErrored ? "Failed" : "Done")}
                {status === "active" && "Running"}
                {status === "waiting" && "Waiting"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-[#6B6B6B] mt-6 text-center">
        Our tests can take up to 5 minutes.
      </p>
      {report?.id && (
        <div className="mt-6">
          <EmailSubscribe reportId={report.id} />
        </div>
      )}
    </div>
  );
}
