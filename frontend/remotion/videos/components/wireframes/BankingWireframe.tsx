/**
 * BankingWireframe — Zoomed-in view of a payment form component.
 * Shows the form progressively filling as steps complete.
 * Tambo-style: dashed border, component label, abstract but clear.
 */

import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONTS } from "../../constants";
import {
  useStepSpring,
  WireframeContainer,
  WireframeField,
  SkeletonBar,
  WireframeButton,
} from "./primitives";

interface BankingWireframeProps {
  activeStepIndex: number;
  stepActivationFrames: number[];
}

const WF = COLORS.wireframe;

export const BankingWireframe: React.FC<BankingWireframeProps> = ({
  activeStepIndex,
  stepActivationFrames,
}) => {
  const stepSpring = useStepSpring(stepActivationFrames);

  // Step 0 (PILLAR): show skeleton
  const skeletonVisible = activeStepIndex >= 0 ? stepSpring(0, 15) : 0;
  // Step 1 (YOUR APP - find payee): payee fills in
  const payeeFound = activeStepIndex >= 1 ? stepSpring(1, 20) : 0;
  // Step 2 (YOUR APP - fill form): amount + preview
  const formFilled = activeStepIndex >= 2 ? stepSpring(2, 20) : 0;
  // Step 3 (DONE): success
  const done = activeStepIndex >= 3 ? stepSpring(3, 15) : 0;

  return (
    <WireframeContainer label={"<PaymentForm>"} opacity={skeletonVisible}>
      {/* Recipient field */}
      <WireframeField
        label="Recipient"
        borderColor={payeeFound > 0.5 ? WF.accent : WF.border}
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
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
                M
              </span>
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
          <SkeletonBar width="70%" />
        )}
      </WireframeField>

      {/* Amount field */}
      <WireframeField
        label="Amount"
        borderColor={formFilled > 0.5 ? WF.accent : WF.border}
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
          <SkeletonBar width="40%" />
        )}
      </WireframeField>

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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{ fontFamily: FONTS.sans, fontSize: 16, color: "#166534" }}
            >
              Send to Maria
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 18,
                fontWeight: 700,
                color: "#166534",
              }}
            >
              $200.00
            </span>
          </div>
          <span
            style={{ fontFamily: FONTS.sans, fontSize: 14, color: "#6B7280" }}
          >
            Date: Today · Fee: $0.00
          </span>
        </div>
      )}

      {/* Submit button */}
      <WireframeButton
        label={done > 0.5 ? "✓ Sent" : "Send $200.00"}
        backgroundColor={done > 0.5 ? "#10B981" : WF.accent}
        opacity={formFilled > 0.3 ? 1 : 0.3}
        scale={done > 0.5 ? 1.02 : 1}
      />
    </WireframeContainer>
  );
};

export default BankingWireframe;
