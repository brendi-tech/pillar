import { interpolate, spring } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type PaymentScreenProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
  accentColor: string;
};

export const PaymentScreen = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
  accentColor,
}: PaymentScreenProps) => {
  // Entrance animation - slides in from right
  const entranceProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.NAVIGATE_PAYMENT),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  const slideX = interpolate(entranceProgress, [0, 1], [100, 0]);

  // Pre-fill highlight effect - fields glow briefly when data is loaded
  const prefillHighlightStart = SCENE_TIMING.NAVIGATE_PAYMENT + 15; // Shortly after form appears
  const prefillHighlightProgress = spring({
    frame: Math.max(0, frame - prefillHighlightStart),
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  // Highlight fades out after appearing
  const highlightOpacity = interpolate(
    frame - prefillHighlightStart,
    [0, 10, 30, 50],
    [0, 0.4, 0.2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Review button highlight (before modal opens)
  const highlightReviewButton = frame >= SCENE_TIMING.MODAL_OPEN - 15 && 
                                 frame < SCENE_TIMING.MODAL_OPEN;
  const reviewButtonPulse = highlightReviewButton
    ? spring({
        frame: frame - (SCENE_TIMING.MODAL_OPEN - 15),
        fps,
        config: { damping: 10, stiffness: 300 },
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: panelWidth,
        bottom: 0,
        backgroundColor: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        transform: `translateX(${slideX}px) translateY(${floatOffset * 0.3}px)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 72,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          gap: 20,
        }}
      >
        {/* Back button */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: "#F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 20,
            color: "#64748B",
          }}
        >
          ←
        </div>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "#1A1A1A",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Send Money
        </span>
      </div>

      {/* Form Content */}
      <div
        style={{
          flex: 1,
          padding: "48px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
          maxWidth: 700,
        }}
      >
        {/* From Account Field - Pre-filled */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            From Account
          </label>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1.5px solid #E2E8F0",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Pre-fill highlight overlay */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: accentColor,
                opacity: highlightOpacity,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#1A1A1A",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Checking ••••4892
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                $12,847.32 available
              </div>
            </div>
            <span style={{ color: "#94A3B8", fontSize: 16, position: "relative" }}>▼</span>
          </div>
        </div>

        {/* To Recipient Field - Pre-filled */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            To
          </label>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1.5px solid #E2E8F0",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Pre-fill highlight overlay */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: accentColor,
                opacity: highlightOpacity,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#1A1A1A",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Sarah Chen
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Cleaner · ••••7823
              </div>
            </div>
            <span style={{ color: "#94A3B8", fontSize: 16, position: "relative" }}>▼</span>
          </div>
        </div>

        {/* Amount Field - Pre-filled */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Amount
          </label>
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1.5px solid #E2E8F0",
              padding: "20px 24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Pre-fill highlight overlay */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: accentColor,
                opacity: highlightOpacity,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: "#1A1A1A",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                letterSpacing: -1,
                position: "relative",
              }}
            >
              $200.00
            </div>
          </div>
        </div>

        {/* Review Payment Button */}
        <div
          style={{
            marginTop: 24,
            backgroundColor: highlightReviewButton ? "#22C55E" : accentColor,
            borderRadius: 14,
            padding: "20px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transform: `scale(${1 + reviewButtonPulse * 0.02})`,
            boxShadow: highlightReviewButton
              ? `0 4px 20px rgba(34, 197, 94, 0.4)`
              : `0 4px 16px ${accentColor}40`,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#FFFFFF",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Review Payment
          </span>
        </div>
      </div>
    </div>
  );
};
