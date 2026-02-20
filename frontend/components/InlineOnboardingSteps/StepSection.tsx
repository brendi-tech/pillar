"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { StepSectionProps } from "./InlineOnboardingSteps.types";

export function StepSection({
  step,
  state,
  isLast,
  onToggle,
  isExpanded,
  children,
}: StepSectionProps) {
  const isLocked = state === "locked";
  const isCompleted = state === "completed";

  const StepIndicator = ({ className }: { className?: string }) => (
    <span
      className={cn(
        "flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
        isCompleted &&
          "border-foreground/20 bg-foreground text-background",
        state === "active" &&
          "border-foreground bg-background text-foreground ring-4 ring-foreground/5",
        isLocked &&
          "border-muted-foreground/20 bg-muted text-muted-foreground",
        className
      )}
    >
      {isCompleted ? (
        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      ) : (
        <span className="text-xs sm:text-sm font-medium">{step.id}</span>
      )}
    </span>
  );

  return (
    <div
      className={cn(
        "relative flex sm:gap-6 w-full overflow-hidden",
        isLocked && "opacity-50"
      )}
    >
      {/* Desktop: Vertical sidebar with step indicator and connecting line */}
      <div className="hidden sm:flex flex-col items-center">
        <button
          type="button"
          disabled={isLocked}
          onClick={onToggle}
          className={cn(
            "relative z-10",
            !isLocked && "cursor-pointer",
            isLocked && "cursor-not-allowed"
          )}
        >
          <StepIndicator />
        </button>

        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 min-h-6",
              isCompleted ? "bg-foreground/20" : "bg-border"
            )}
          />
        )}
      </div>

      <div className={cn("flex-1 pb-6 sm:pb-10 overflow-hidden", isLast && "pb-0")}>
        <button
          type="button"
          disabled={isLocked}
          onClick={onToggle}
          className={cn(
            "text-left w-full",
            !isLocked && "cursor-pointer",
            isLocked && "cursor-not-allowed"
          )}
        >
          <h3
            className={cn(
              "text-base font-semibold leading-tight inline-flex items-center gap-2",
              isLocked ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {/* Mobile: Inline step indicator */}
            <span className="sm:hidden">
              <StepIndicator />
            </span>
            {step.title}
            {step.optional && (
              <Badge
                variant="outline"
                className="text-[10px] font-normal px-1.5 py-0"
              >
                Optional
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 sm:mt-0.5 ml-8 sm:ml-0">
            {step.description}
          </p>
        </button>

        {isExpanded && !isLocked && (
          <div className="mt-4 w-full overflow-hidden">{children}</div>
        )}
      </div>
    </div>
  );
}
