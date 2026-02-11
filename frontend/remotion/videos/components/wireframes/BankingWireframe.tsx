/**
 * BankingWireframe — Zoomed-in view of a payment form component.
 * Shows the form progressively filling as steps complete.
 * Tambo-style: dashed border, component label, abstract but clear.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../constants";

interface BankingWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

export const BankingWireframe: React.FC<BankingWireframeProps> = ({
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

  // Step 0 (PILLAR): show skeleton
  const skeletonVisible = activeStepIndex >= 0 ? stepSpring(0, 15) : 0;
  // Step 1 (YOUR APP - find payee): payee fills in
  const payeeFound = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  // Step 2 (YOUR APP - fill form): amount + preview
  const formFilled = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
  // Step 3 (DONE): success
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
      {/* Component wrapper with dashed border */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          border: `2px dashed ${WF.border}`,
          borderRadius: 20,
          padding: 40,
          backgroundColor: WF.background,
          opacity: interpolate(skeletonVisible, [0, 1], [0.3, 1]),
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
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 16,
              color: WF.textLight,
              fontWeight: 500,
            }}
          >
            {"<PaymentForm>"}
          </span>
        </div>

        {/* Recipient field */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              fontWeight: 600,
              color: WF.textLight,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Recipient
          </div>
          <div
            style={{
              height: 56,
              borderRadius: 10,
              border: `2px solid ${payeeFound > 0.5 ? COLORS.wireframe.accent : WF.border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              gap: 14,
            }}
          >
            {payeeFound > 0.5 ? (
              <>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#10B981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: payeeFound,
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>M</span>
                </div>
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 18,
                    color: WF.text,
                    fontWeight: 500,
                    opacity: payeeFound,
                  }}
                >
                  Maria (Cleaner)
                </span>
              </>
            ) : (
              <div style={{ width: "70%", height: 16, backgroundColor: WF.placeholder, borderRadius: 4 }} />
            )}
          </div>
        </div>

        {/* Amount field */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              fontWeight: 600,
              color: WF.textLight,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Amount
          </div>
          <div
            style={{
              height: 56,
              borderRadius: 10,
              border: `2px solid ${formFilled > 0.5 ? COLORS.wireframe.accent : WF.border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
            }}
          >
            {formFilled > 0.5 ? (
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 28,
                  fontWeight: 700,
                  color: WF.text,
                  opacity: formFilled,
                }}
              >
                $200.00
              </span>
            ) : (
              <div style={{ width: "40%", height: 16, backgroundColor: WF.placeholder, borderRadius: 4 }} />
            )}
          </div>
        </div>

        {/* Preview summary */}
        {formFilled > 0.5 && (
          <div
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              border: "1.5px solid #BBF7D0",
              padding: 20,
              marginBottom: 24,
              opacity: formFilled,
              transform: `translateY(${interpolate(formFilled, [0.5, 1], [8, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: FONTS.sans, fontSize: 16, color: "#166534" }}>
                Send to Maria
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: "#166534" }}>
                $200.00
              </span>
            </div>
            <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: "#6B7280" }}>
              Date: Today · Fee: $0.00
            </span>
          </div>
        )}

        {/* Submit button */}
        <div
          style={{
            height: 52,
            borderRadius: 10,
            backgroundColor: done > 0.5 ? "#10B981" : COLORS.wireframe.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: formFilled > 0.3 ? 1 : 0.3,
            transform: `scale(${done > 0.5 ? 1.02 : 1})`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 18,
              fontWeight: 600,
              color: "#FFFFFF",
            }}
          >
            {done > 0.5 ? "✓ Sent" : "Send $200.00"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BankingWireframe;
