/**
 * TechnicalStepTimeline — Card-based step progression.
 *
 * All steps always visible with full readable text.
 * Active step gets a colored highlight border/glow that varies by actor.
 * Steps are clickable to jump the video to that point.
 * Connected by a dashed vertical line.
 */

import type { DemoStep, StepActor, StepState } from "../../remotion/videos/types";

// Actor display config — each actor gets a distinct highlight color
const ACTOR_CONFIG: Record<
  StepActor,
  {
    label: string;
    color: string;
    bgColor: string;
    glowColor: string;
    icon: string;
    iconBg: string;
  }
> = {
  user: {
    label: "USER",
    color: "#6B7280",
    bgColor: "#F9FAFB",
    glowColor: "rgba(107, 114, 128, 0.12)",
    icon: "💬",
    iconBg: "#F3F4F6",
  },
  pillar: {
    label: "PILLAR",
    color: "#FF6E00",
    bgColor: "#FFFBF5",
    glowColor: "rgba(255, 110, 0, 0.10)",
    icon: "⚡",
    iconBg: "#FFF7ED",
  },
  app: {
    label: "YOUR APP",
    color: "#059669",
    bgColor: "#F0FDF9",
    glowColor: "rgba(5, 150, 105, 0.10)",
    icon: "→",
    iconBg: "#ECFDF5",
  },
  done: {
    label: "DONE",
    color: "#10B981",
    bgColor: "#F0FDF9",
    glowColor: "rgba(16, 185, 129, 0.10)",
    icon: "✓",
    iconBg: "#ECFDF5",
  },
};

function getStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

// ──────────────────────────────────────────────
// StepCard
// ──────────────────────────────────────────────

function StepCard({
  step,
  state,
  onClick,
}: {
  step: DemoStep;
  state: StepState;
  onClick?: () => void;
}) {
  const cfg = ACTOR_CONFIG[step.actor];
  const isActive = state === "active";
  const isCompleted = state === "completed";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="relative rounded-xl border px-4 py-3.5 transition-all duration-300 cursor-pointer select-none"
      style={{
        backgroundColor: isActive ? cfg.bgColor : "#FFFFFF",
        borderColor: isActive ? cfg.color : "#EBEBEB",
        boxShadow: isActive
          ? `0 0 0 3px ${cfg.glowColor}, 0 4px 12px ${cfg.glowColor}`
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex gap-3 items-start">
        {/* Icon circle */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{
            backgroundColor: isActive
              ? `${cfg.color}18`
              : isCompleted
                ? "#F0FDF4"
                : cfg.iconBg,
          }}
        >
          {isCompleted ? (
            <span className="text-sm" style={{ color: "#10B981" }}>
              ✓
            </span>
          ) : (
            <span
              className="text-sm"
              style={{
                color: isActive ? cfg.color : "#9CA3AF",
              }}
            >
              {cfg.icon}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Actor badge */}
          <span
            className="inline-block font-mono text-[10px] font-bold tracking-wider mb-1 transition-colors duration-300"
            style={{
              color: isActive ? cfg.color : isCompleted ? "#9CA3AF" : cfg.color,
              opacity: isActive ? 1 : isCompleted ? 0.7 : 0.6,
            }}
          >
            {cfg.label}
          </span>

          {/* Label */}
          <div
            className="text-[13px] font-semibold leading-snug transition-colors duration-300"
            style={{
              color: isActive
                ? "#1A1A1A"
                : isCompleted
                  ? "#6B7280"
                  : "#374151",
            }}
          >
            {step.label}
          </div>

          {/* Description */}
          <div
            className="text-[12px] leading-relaxed mt-0.5 transition-colors duration-300"
            style={{
              color: isActive ? "#4B5563" : isCompleted ? "#9CA3AF" : "#9CA3AF",
            }}
          >
            {step.description}
          </div>

          {/* Technical detail */}
          {step.detail && (
            <div
              className="font-mono text-[11px] leading-relaxed mt-1.5 px-2.5 py-1.5 rounded-md transition-all duration-300 whitespace-pre-line"
              style={{
                color: isActive
                  ? cfg.color
                  : isCompleted
                    ? "#9CA3AF"
                    : "#A0A0A0",
                backgroundColor: isActive ? `${cfg.color}08` : "#F9FAFB",
                borderLeft: `2px solid ${isActive ? cfg.color : "#E5E7EB"}`,
              }}
            >
              {step.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// TechnicalStepTimeline
// ──────────────────────────────────────────────

interface TechnicalStepTimelineProps {
  steps: DemoStep[];
  activeStepIndex: number;
  /** Called when a user clicks a step — parent should seek video */
  onStepClick?: (stepIndex: number) => void;
}

export function TechnicalStepTimeline({
  steps,
  activeStepIndex,
  onStepClick,
}: TechnicalStepTimelineProps) {
  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const state = getStepState(index, activeStepIndex);
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="relative">
            {/* Dashed connector between cards */}
            {!isLast && (
              <div
                className="absolute left-[22px] top-full w-0 h-3 border-l-2 border-dashed transition-colors duration-300"
                style={{
                  borderColor:
                    index < activeStepIndex ? "#10B981" : "#E0E0E0",
                }}
              />
            )}
            <StepCard
              step={step}
              state={state}
              onClick={() => onStepClick?.(index)}
            />
          </div>
        );
      })}
    </div>
  );
}
