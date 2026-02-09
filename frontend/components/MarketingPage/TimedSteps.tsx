"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useInView } from "../marketing/hooks/useInView";

export interface Step {
  title: string;
  subtitle?: string;
  isComplete?: boolean;
}

export interface TimedStepsProps {
  steps: Step[];
  /** Duration for each step's bar fill animation in ms (default: 3000) */
  stepDuration?: number;
}

/**
 * TimedSteps - Sequential progress steps with animated loading bars
 *
 * When the component scrolls into view, each step's progress bar fills
 * in sequence before moving to the next step.
 */
export function TimedSteps({ steps, stepDuration = 3000 }: TimedStepsProps) {
  const { ref, isInView } = useInView({ threshold: 0.5, rootMargin: "0px" });
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [hasStarted, setHasStarted] = useState(false);

  // Start the animation sequence when component comes into view
  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true);
      setActiveStepIndex(0);
    }
  }, [isInView, hasStarted]);

  // Progress through steps sequentially
  useEffect(() => {
    if (activeStepIndex >= 0 && activeStepIndex < steps.length) {
      const timer = setTimeout(() => {
        setActiveStepIndex((prev) => prev + 1);
      }, stepDuration);

      return () => clearTimeout(timer);
    }
  }, [activeStepIndex, steps.length, stepDuration]);

  const getStepState = (index: number) => {
    if (index < activeStepIndex) return "completed";
    if (index === activeStepIndex) return "active";
    return "pending";
  };

  return (
    <div ref={ref} className="w-full">
      <div
        className="h-[1px] w-full"
        style={{
          background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
        }}
      />
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const state = getStepState(index);

          return (
            <div
              key={index}
              className="flex flex-col h-full border-t sm:border-t-0 sm:border-l first:border-t-0 sm:first:border-l-0 border-[#E5E0D8] pb-3"
              style={{
                backgroundColor: state === "completed" ? "#F3EFE8" : "#FFFFFF",
              }}
            >
              {/* Step content */}
              <div className="flex-1 p-4 md:pb-16 pb-8">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#1A1A1A] text-base">
                      {step.title}
                    </h3>
                    {step.subtitle && (
                      <p className="text-sm text-[#6B6B6B] mt-1">
                        {step.subtitle}
                      </p>
                    )}
                  </div>
                  {state === "completed" && (
                    <div className="text-[#22C55E] shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-4">
                <div
                  className="h-1 w-full"
                  style={{ backgroundColor: "rgba(255, 110, 0, 0.1)" }}
                >
                  <div
                    className="h-full transition-all ease-linear"
                    style={{
                      backgroundColor: "#FF6E00",
                      width:
                        state === "completed"
                          ? "100%"
                          : state === "active"
                            ? "100%"
                            : "0%",
                      transitionDuration:
                        state === "active" ? `${stepDuration}ms` : "0ms",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
