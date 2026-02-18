import { spring, interpolate } from "remotion";
import { BlinkingCursor } from "./BlinkingCursor";
import { SCENE_TIMING } from "./CameraController";

type EditDepositModalProps = {
  frame: number;
  fps: number;
  visible: boolean;
  entranceFrame: number;
  panelWidth: number;
};

// HR-specific colors
const ACCENT_COLOR = "#8B5CF6"; // Purple

export const EditDepositModal = ({
  frame,
  fps,
  visible,
  entranceFrame,
  panelWidth,
}: EditDepositModalProps) => {
  if (!visible) return null;

  // Modal entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const modalScale = interpolate(entranceProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  const backdropOpacity = interpolate(entranceProgress, [0, 1], [0, 0.5]);

  // Field highlight timing - sequential highlights
  const fieldHighlights = [
    { field: "bank", startFrame: SCENE_TIMING.READY_STATE, duration: 35 },
    { field: "routing", startFrame: SCENE_TIMING.READY_STATE + 15, duration: 35 },
    { field: "account", startFrame: SCENE_TIMING.READY_STATE + 30, duration: 35 },
  ];

  const getFieldHighlight = (fieldName: string) => {
    const highlight = fieldHighlights.find((h) => h.field === fieldName);
    if (!highlight) return 0;

    const elapsed = frame - highlight.startFrame;
    if (elapsed < 0 || elapsed > highlight.duration) return 0;

    // Pulse effect
    const pulsePhase = Math.sin((elapsed / 8) * Math.PI) * 0.5 + 0.5;
    return interpolate(pulsePhase, [0, 1], [0.2, 0.5]);
  };

  // Callout visibility
  const getCalloutOpacity = (index: number) => {
    const highlight = fieldHighlights[index];
    if (!highlight) return 0;

    const elapsed = frame - highlight.startFrame;
    if (elapsed < 0) return 0;

    return spring({
      frame: elapsed,
      fps,
      config: { damping: 15, stiffness: 200 },
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: panelWidth,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
          transition: "none",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: 520,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          transform: `scale(${modalScale})`,
          opacity: modalOpacity,
          overflow: "hidden",
          transition: "none",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1F2937",
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Edit Direct Deposit
          </h2>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "#6B7280", fontSize: 16 }}>✕</span>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ padding: "28px" }}>
          {/* Bank Name Field */}
          <div style={{ marginBottom: 24, position: "relative" }}>
            {/* Callout - positioned inline before label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  opacity: getCalloutOpacity(0),
                  transition: "none",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: ACCENT_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 12,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  1
                </div>
              </div>

              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Bank Name
              </label>
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: `2px solid ${ACCENT_COLOR}`,
                backgroundColor: "#FFFFFF",
                fontSize: 16,
                color: "#1F2937",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: `0 0 0 4px rgba(139, 92, 246, ${getFieldHighlight("bank")})`,
                display: "flex",
                alignItems: "center",
                transition: "none",
              }}
            >
              <span style={{ color: "#9CA3AF" }}>Select your bank...</span>
              <BlinkingCursor frame={frame} startFrame={entranceFrame} visible={true} />
              <span style={{ marginLeft: "auto", color: "#9CA3AF" }}>▼</span>
            </div>
          </div>

          {/* Routing Number Field */}
          <div style={{ marginBottom: 24, position: "relative" }}>
            {/* Callout - positioned inline before label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  opacity: getCalloutOpacity(1),
                  transition: "none",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: ACCENT_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 12,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  2
                </div>
              </div>
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Routing Number
              </label>
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                backgroundColor: "#FFFFFF",
                fontSize: 16,
                color: "#9CA3AF",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: `0 0 0 4px rgba(139, 92, 246, ${getFieldHighlight("routing")})`,
                transition: "none",
              }}
            >
              9-digit routing number
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#6B7280",
                margin: "6px 0 0 0",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Found on your check or bank statement
            </p>
          </div>

          {/* Account Number Field */}
          <div style={{ marginBottom: 24, position: "relative" }}>
            {/* Callout - positioned inline before label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  opacity: getCalloutOpacity(2),
                  transition: "none",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: ACCENT_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 12,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  3
                </div>
              </div>
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Account Number
              </label>
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                backgroundColor: "#FFFFFF",
                fontSize: 16,
                color: "#9CA3AF",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: `0 0 0 4px rgba(139, 92, 246, ${getFieldHighlight("account")})`,
                transition: "none",
              }}
            >
              Your account number
            </div>
          </div>

          {/* Account Type Field */}
          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Account Type
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: `2px solid ${ACCENT_COLOR}`,
                  backgroundColor: `rgba(139, 92, 246, 0.05)`,
                  fontSize: 15,
                  fontWeight: 500,
                  color: ACCENT_COLOR,
                  textAlign: "center",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  cursor: "pointer",
                }}
              >
                Checking
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  backgroundColor: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#6B7280",
                  textAlign: "center",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  cursor: "pointer",
                }}
              >
                Savings
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                backgroundColor: "#FFFFFF",
                fontSize: 15,
                fontWeight: 500,
                color: "#6B7280",
                cursor: "pointer",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Cancel
            </button>
            <button
              style={{
                padding: "12px 32px",
                borderRadius: 10,
                border: "none",
                backgroundColor: ACCENT_COLOR,
                fontSize: 15,
                fontWeight: 600,
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
