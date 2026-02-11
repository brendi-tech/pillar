/**
 * PMWireframe — Zoomed-in kanban board component.
 * Shows a new bug card being created and placed into a sprint column.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../constants";

interface PMWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

/** Kanban card */
const Card: React.FC<{
  title: string;
  priority?: string;
  priorityColor?: string;
  type?: string;
  isNew?: boolean;
  opacity: number;
}> = ({ title, priority, priorityColor, type, isNew = false, opacity }) => (
  <div
    style={{
      backgroundColor: WF.background,
      borderRadius: 10,
      border: `1.5px solid ${isNew ? COLORS.wireframe.accent : WF.border}`,
      padding: 14,
      opacity,
      boxShadow: isNew ? `0 4px 20px ${COLORS.wireframe.accent}25` : "0 1px 3px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      {type && (
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: type === "Bug" ? "#EF4444" : "#6B7280",
            backgroundColor: type === "Bug" ? "#FEF2F2" : WF.placeholder,
            padding: "3px 8px",
            borderRadius: 5,
            fontWeight: 700,
          }}
        >
          {type}
        </span>
      )}
      {priority && (
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: priorityColor || "#6B7280",
            backgroundColor: `${priorityColor || "#6B7280"}15`,
            padding: "3px 8px",
            borderRadius: 5,
            fontWeight: 700,
          }}
        >
          {priority}
        </span>
      )}
    </div>
    <span style={{ fontFamily: FONTS.sans, fontSize: 15, color: WF.text, fontWeight: 500 }}>
      {title}
    </span>
  </div>
);

export const PMWireframe: React.FC<PMWireframeProps> = ({
  activeStepIndex,
  stepActivationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stepSpring = (stepIdx: number, delay = 0) =>
    spring({
      frame: frame - (stepActivationFrames[stepIdx] || 0) - delay,
      fps,
      config: { damping: 18, stiffness: 100, mass: 0.8 },
    });

  const planVisible = activeStepIndex >= 0 ? stepSpring(0, 15) : 0;
  const issueCreated = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  const addedToSprint = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
  const done = activeStepIndex >= 3 ? stepSpring(3, 15) : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          border: `2px dashed ${WF.border}`,
          borderRadius: 20,
          padding: 32,
          backgroundColor: "#F8FAFC",
          opacity: interpolate(planVisible, [0, 1], [0.3, 1]),
          position: "relative",
        }}
      >
        {/* Component label */}
        <div
          style={{
            position: "absolute",
            top: -14,
            left: 32,
            backgroundColor: COLORS.background,
            padding: "2px 12px",
          }}
        >
          <span style={{ fontFamily: FONTS.mono, fontSize: 16, color: WF.textLight, fontWeight: 500 }}>
            {"<SprintBoard>"}
          </span>
        </div>

        {/* Kanban columns */}
        <div style={{ display: "flex", gap: 16, minHeight: 380 }}>
          {/* Backlog */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: WF.textLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Backlog
            </span>
            <Card title="Update error messages" type="Task" opacity={0.4} />
            <Card title="Refactor auth flow" type="Task" opacity={0.4} />
          </div>

          {/* In Progress */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: WF.textLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              In Progress
            </span>
            <Card title="Dashboard redesign" type="Feature" opacity={0.4} />
          </div>

          {/* Sprint 24 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: addedToSprint > 0.5 ? COLORS.wireframe.accent : WF.textLight,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Sprint 24
              </span>
              {addedToSprint > 0.5 && (
                <span style={{ fontSize: 10, color: COLORS.wireframe.accent }}>●</span>
              )}
            </div>
            <Card title="Fix payment gateway" type="Bug" priority="P2" priorityColor="#F59E0B" opacity={0.4} />
            {/* New card */}
            {issueCreated > 0.3 && (
              <div
                style={{
                  opacity: issueCreated,
                  transform: `translateY(${interpolate(addedToSprint > 0 ? addedToSprint : 0, [0, 1], [8, 0])}px)`,
                }}
              >
                <Card
                  title="Checkout crash"
                  type="Bug"
                  priority="P1"
                  priorityColor="#EF4444"
                  isNew={done > 0.3}
                  opacity={1}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PMWireframe;
