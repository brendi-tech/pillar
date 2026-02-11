/**
 * StepItem — A single step card in the timeline.
 * Uses actor-based labels (USER, PILLAR, YOUR APP, DONE)
 * with larger text and optional technical detail.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { DemoStep, StepState } from "../types";
import { ACTOR_CONFIG, COLORS, FONTS } from "../constants";

interface StepItemProps {
  step: DemoStep;
  state: StepState;
  /** Frame at which this step became active */
  activateFrame: number;
  index: number;
}

export const StepItem: React.FC<StepItemProps> = ({
  step,
  state,
  activateFrame,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actorCfg = ACTOR_CONFIG[step.actor];

  // Entry animation
  const entryProgress = spring({
    frame: frame - index * 12,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 },
  });
  const translateY = interpolate(entryProgress, [0, 1], [24, 0]);
  const entryOpacity = interpolate(entryProgress, [0, 1], [0, 1]);

  // Active highlight animation
  const activeProgress =
    state === "active" || state === "completed"
      ? spring({
          frame: frame - activateFrame,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.6 },
        })
      : 0;

  // Completed check animation
  const checkProgress =
    state === "completed"
      ? spring({
          frame: frame - (activateFrame + step.durationFrames),
          fps,
          config: { damping: 15, stiffness: 180, mass: 0.5 },
        })
      : 0;

  // Description and detail fade
  const contentOpacity =
    state === "active"
      ? interpolate(
          spring({
            frame: frame - activateFrame - 5,
            fps,
            config: { damping: 20, stiffness: 100 },
          }),
          [0, 1],
          [0, 1]
        )
      : state === "completed"
        ? interpolate(checkProgress, [0, 0.5], [1, 0.7], {
            extrapolateRight: "clamp",
          })
        : 0;

  const isActive = state === "active";
  const isCompleted = state === "completed";
  const isPending = state === "pending";

  return (
    <div
      style={{
        opacity: entryOpacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        padding: "14px 0",
      }}
    >
      {/* Status circle */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          backgroundColor: isCompleted
            ? COLORS.completed.check
            : isActive
              ? actorCfg.color
              : COLORS.pending.circle,
          transform: `scale(${isActive ? 1 + activeProgress * 0.08 : 1})`,
          boxShadow: isActive
            ? `0 0 24px ${actorCfg.color}40`
            : "none",
        }}
      >
        {isCompleted ? (
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: 700,
              opacity: checkProgress,
              transform: `scale(${checkProgress})`,
            }}
          >
            ✓
          </span>
        ) : (
          <span
            style={{
              color: isActive ? "#FFFFFF" : COLORS.pending.text,
              fontSize: 16,
            }}
          >
            {actorCfg.icon}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Actor badge */}
        <div
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 4,
            backgroundColor: isPending ? "#F3F4F6" : actorCfg.bgColor,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 700,
              color: isPending ? COLORS.pending.text : actorCfg.color,
              letterSpacing: "0.08em",
            }}
          >
            {actorCfg.label}
          </span>
        </div>

        {/* Label */}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 20,
            fontWeight: 600,
            color: isCompleted
              ? COLORS.completed.text
              : isPending
                ? COLORS.pending.text
                : "#1A1A1A",
            lineHeight: 1.4,
            marginBottom: 4,
          }}
        >
          {step.label}
        </div>

        {/* Description */}
        {contentOpacity > 0 && (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              color: isCompleted ? COLORS.completed.text : "#6B7280",
              opacity: contentOpacity,
              lineHeight: 1.6,
            }}
          >
            {step.description}
          </div>
        )}

        {/* Technical detail */}
        {contentOpacity > 0 && step.detail && (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 14,
              color: isCompleted ? COLORS.completed.text : actorCfg.color,
              opacity: contentOpacity * 0.9,
              marginTop: 6,
              padding: "6px 10px",
              backgroundColor: isPending ? "transparent" : `${actorCfg.bgColor}`,
              borderRadius: 6,
              borderLeft: `3px solid ${actorCfg.color}30`,
              lineHeight: 1.5,
            }}
          >
            {step.detail}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepItem;
