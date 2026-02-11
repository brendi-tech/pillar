/**
 * AnalyticsWireframe — Zoomed-in dashboard component.
 * Shows a 2x2 grid of chart widgets being created one by one.
 * Bigger, simpler charts with clear labels.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../constants";

interface AnalyticsWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

/** Simple chart visualization */
const ChartWidget: React.FC<{
  title: string;
  type: "line" | "bar" | "area" | "number";
  color: string;
  value?: string;
  opacity: number;
  isNew: boolean;
}> = ({ title, type, color, value, opacity, isNew }) => {
  const barHeights = [35, 55, 40, 70, 50, 65, 80, 55];

  return (
    <div
      style={{
        backgroundColor: WF.background,
        borderRadius: 12,
        border: `1.5px solid ${isNew ? color : WF.border}`,
        padding: 18,
        opacity,
        boxShadow: isNew ? `0 0 20px ${color}25` : "none",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600, color: WF.text }}>
          {title}
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: WF.textLight }}>7d</span>
      </div>

      {type === "number" && value ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 36, fontWeight: 700, color }}>
            {value}
          </span>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 5,
            minHeight: 60,
          }}
        >
          {type === "line" ? (
            <svg width="100%" height="70" viewBox="0 0 240 70" preserveAspectRatio="none">
              <polyline
                points={barHeights.map((h, i) => `${i * 34 + 10},${70 - h}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          ) : type === "area" ? (
            <svg width="100%" height="70" viewBox="0 0 240 70" preserveAspectRatio="none">
              <polygon
                points={
                  barHeights.map((h, i) => `${i * 34 + 10},${70 - h}`).join(" ") +
                  ` 248,70 10,70`
                }
                fill={`${color}20`}
              />
              <polyline
                points={barHeights.map((h, i) => `${i * 34 + 10},${70 - h}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            barHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: opacity > 0.5 ? h : 4,
                  backgroundColor: color,
                  borderRadius: 4,
                  opacity: 0.7,
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const AnalyticsWireframe: React.FC<AnalyticsWireframeProps> = ({
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
  const chartsCreated = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  const chartsAssembled = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
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
          maxWidth: 560,
          border: `2px dashed ${WF.border}`,
          borderRadius: 20,
          padding: 32,
          backgroundColor: WF.background,
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
            {"<Dashboard>"}
          </span>
        </div>

        {/* Dashboard title */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 20, fontWeight: 600, color: WF.text }}>
            {chartsCreated > 0.5 ? "User Engagement" : "New Dashboard"}
          </span>
        </div>

        {/* 2x2 chart grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 14,
            height: 340,
          }}
        >
          {/* Chart 1: DAU */}
          <ChartWidget
            title="Daily Active Users"
            type="line"
            color="#3B82F6"
            opacity={chartsCreated > 0.3 ? chartsCreated : 0.15}
            isNew={chartsCreated > 0.5 && chartsAssembled < 0.5}
          />
          {/* Chart 2: Session Duration */}
          <ChartWidget
            title="Session Duration"
            type="bar"
            color="#8B5CF6"
            opacity={chartsCreated > 0.6 ? chartsCreated : 0.15}
            isNew={chartsCreated > 0.7 && chartsAssembled < 0.5}
          />
          {/* Chart 3: Retention */}
          <ChartWidget
            title="Retention"
            type="area"
            color="#10B981"
            opacity={chartsAssembled > 0.3 ? chartsAssembled : 0.15}
            isNew={chartsAssembled > 0.4 && done < 0.5}
          />
          {/* Chart 4: Signups */}
          <ChartWidget
            title="Weekly Signups"
            type="number"
            color="#FF6E00"
            value="1,247"
            opacity={chartsAssembled > 0.6 ? chartsAssembled : 0.15}
            isNew={chartsAssembled > 0.7 && done < 0.5}
          />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsWireframe;
