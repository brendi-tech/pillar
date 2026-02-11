/**
 * CRMWireframe — Zoomed-in view showing API calls then handoff form.
 * First half: terminal log of Salesforce API calls.
 * Second half: zoomed-in handoff form component.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../constants";

interface CRMWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

export const CRMWireframe: React.FC<CRMWireframeProps> = ({
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
  const searchVisible = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  const notifyVisible = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
  const doneVisible = activeStepIndex >= 3 ? stepSpring(3, 15) : 0;

  const showForm = notifyVisible > 0.6;

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
          overflow: "hidden",
          backgroundColor: showForm ? WF.background : "#111827",
          position: "relative",
          opacity: interpolate(planVisible, [0, 1], [0.3, 1]),
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
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 16,
              color: WF.textLight,
              fontWeight: 500,
            }}
          >
            {showForm ? "<HandoffForm>" : "<Salesforce API>"}
          </span>
        </div>

        {/* Terminal header */}
        {!showForm && (
          <div
            style={{
              height: 40,
              backgroundColor: "#1F2937",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 8,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#F59E0B" }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981" }} />
          </div>
        )}

        <div style={{ padding: 32 }}>
          {!showForm ? (
            /* API log view */
            <div>
              {searchVisible > 0 && (
                <div style={{ opacity: searchVisible, marginBottom: 24 }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 17 }}>
                    <span style={{ color: "#3B82F6", fontWeight: 700 }}>GET</span>
                    <span style={{ color: "#9CA3AF" }}> /opportunities?name=Walmart</span>
                  </div>
                  {searchVisible > 0.7 && (
                    <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: "#10B981", paddingLeft: 20, marginTop: 6 }}>
                      {"→ 200 { name: \"Walmart Q4\", id: \"opp_47x\" }"}
                    </div>
                  )}
                  <div style={{ fontFamily: FONTS.mono, fontSize: 17, marginTop: 20 }}>
                    <span style={{ color: "#F59E0B", fontWeight: 700 }}>PATCH</span>
                    <span style={{ color: "#9CA3AF" }}> /opportunities/opp_47x</span>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: "#6B7280", paddingLeft: 20, marginTop: 6 }}>
                    {"{ stage: \"Closed Won\" }"}
                  </div>
                  {searchVisible > 0.9 && (
                    <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: "#10B981", paddingLeft: 20, marginTop: 4 }}>
                      {"→ 200 OK"}
                    </div>
                  )}
                </div>
              )}
              {notifyVisible > 0 && (
                <div style={{ opacity: notifyVisible }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 17 }}>
                    <span style={{ color: "#10B981", fontWeight: 700 }}>POST</span>
                    <span style={{ color: "#9CA3AF" }}> /notifications</span>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: "#6B7280", paddingLeft: 20, marginTop: 6 }}>
                    {"{ team: \"implementation\" }"}
                  </div>
                  {notifyVisible > 0.7 && (
                    <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: "#10B981", paddingLeft: 20, marginTop: 4 }}>
                      {"→ 200 { sent: true }"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Handoff form view */
            <div style={{ opacity: notifyVisible, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ fontFamily: FONTS.sans, fontSize: 22, fontWeight: 600, color: WF.text }}>
                Implementation Handoff
              </div>
              {[
                { label: "Deal", value: "Walmart Q4 — $2.4M" },
                { label: "Contact", value: "Sarah Chen, VP Operations" },
                { label: "Notes", value: "Standard enterprise tier, 3yr term" },
              ].map((field, i) => (
                <div key={i}>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {field.label}
                  </div>
                  <div
                    style={{
                      height: 48,
                      borderRadius: 8,
                      border: `1.5px solid ${doneVisible > 0.5 ? "#10B981" : WF.border}`,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 16px",
                      backgroundColor: "#F9FAFB",
                    }}
                  >
                    <span style={{ fontFamily: FONTS.sans, fontSize: 17, color: WF.text }}>
                      {field.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMWireframe;
