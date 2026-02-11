/**
 * HRWireframe — Zoomed-in settings panel component.
 * Shows the Direct Deposit section expanding and fields being highlighted.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../constants";

interface HRWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

export const HRWireframe: React.FC<HRWireframeProps> = ({
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
  const navigated = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  const editOpen = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
  const done = activeStepIndex >= 3 ? stepSpring(3, 15) : 0;

  const highlightPulse = activeStepIndex >= 2 ? (frame - stepActivationFrames[2]) / fps : 0;

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
            {"<PayrollSettings>"}
          </span>
        </div>

        {/* Section: Tax Information (collapsed) */}
        <div
          style={{
            borderRadius: 10,
            border: `1.5px solid ${WF.border}`,
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            marginBottom: 14,
            opacity: 0.5,
          }}
        >
          <span style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 600, color: WF.textLight }}>
            Tax Information
          </span>
          <span style={{ fontSize: 14, color: WF.textLight }}>▼</span>
        </div>

        {/* Section: Direct Deposit (expands) */}
        <div
          style={{
            borderRadius: 10,
            border: `1.5px solid ${navigated > 0.5 ? COLORS.wireframe.accent : WF.border}`,
            overflow: "hidden",
            marginBottom: 14,
            boxShadow: navigated > 0.5 && editOpen < 0.5 ? `0 0 16px ${COLORS.wireframe.accent}20` : "none",
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              backgroundColor: navigated > 0.5 ? `${COLORS.wireframe.accent}08` : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 600,
                color: navigated > 0.5 ? COLORS.wireframe.accent : WF.text,
              }}
            >
              Direct Deposit
            </span>
            <span
              style={{
                fontSize: 14,
                color: WF.textLight,
                transform: `rotate(${navigated > 0.5 ? 180 : 0}deg)`,
              }}
            >
              ▼
            </span>
          </div>

          {/* Expanded content */}
          {navigated > 0.5 && (
            <div
              style={{
                borderTop: `1px solid ${WF.border}`,
                padding: 20,
                opacity: navigated,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {editOpen > 0.5 ? (
                /* Editable fields */
                <>
                  {[
                    { label: "Routing Number", placeholder: "Enter 9-digit routing number", highlight: true },
                    { label: "Account Number", placeholder: "Enter account number", highlight: true },
                    { label: "Account Type", placeholder: "Checking", highlight: false },
                  ].map((field, i) => (
                    <div key={i}>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: 600,
                          color: field.highlight ? COLORS.wireframe.accent : "#6B7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 6,
                        }}
                      >
                        {field.label}
                      </div>
                      <div
                        style={{
                          height: 48,
                          borderRadius: 8,
                          border: `2px solid ${field.highlight ? COLORS.wireframe.accent : WF.border}`,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 16px",
                          backgroundColor: field.highlight ? `${COLORS.wireframe.accent}08` : "#F9FAFB",
                          boxShadow: field.highlight
                            ? `0 0 ${10 + Math.sin(highlightPulse * Math.PI * 3) * 4}px ${COLORS.wireframe.accent}25`
                            : "none",
                        }}
                      >
                        <span style={{ fontFamily: FONTS.sans, fontSize: 16, color: WF.textLight }}>
                          {field.placeholder}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: COLORS.wireframe.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 8,
                      opacity: done > 0 ? 1 : 0.9,
                    }}
                  >
                    <span style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}>
                      Save Changes
                    </span>
                  </div>
                </>
              ) : (
                /* Read-only view */
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 15, color: "#6B7280" }}>
                    Bank of America ••••4821
                  </span>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.wireframe.accent, fontWeight: 600 }}>
                    Edit
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section: Pay Schedule (collapsed) */}
        <div
          style={{
            borderRadius: 10,
            border: `1.5px solid ${WF.border}`,
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            opacity: 0.5,
          }}
        >
          <span style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 600, color: WF.textLight }}>
            Pay Schedule
          </span>
          <span style={{ fontSize: 14, color: WF.textLight }}>▼</span>
        </div>
      </div>
    </div>
  );
};

export default HRWireframe;
