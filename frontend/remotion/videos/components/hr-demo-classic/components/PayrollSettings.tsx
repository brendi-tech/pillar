import { spring, interpolate } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type PayrollSettingsProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  opacity: number;
};

// HR-specific colors
const ACCENT_COLOR = "#8B5CF6"; // Purple

export const PayrollSettings = ({
  frame,
  fps,
  floatOffset,
  opacity,
}: PayrollSettingsProps) => {
  // Entrance animation for payroll page
  const entranceProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.NAVIGATE_TO_PAYROLL),
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const contentY = interpolate(entranceProgress, [0, 1], [30, 0]);
  const contentOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);

  // Highlight animation for Direct Deposit section
  const sectionHighlightStart = SCENE_TIMING.OPEN_SECTION;
  const highlightProgress = spring({
    frame: Math.max(0, frame - sectionHighlightStart),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  // Pulse animation for the section
  const pulsePhase = Math.sin((frame - sectionHighlightStart) / 8) * 0.5 + 0.5;
  const showHighlight = frame >= sectionHighlightStart && frame < SCENE_TIMING.FORM_START;
  const highlightOpacity = showHighlight ? interpolate(pulsePhase, [0, 1], [0.3, 0.6]) : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#F9FAFB",
        opacity,
        transition: "none",
      }}
    >
      {/* Top Navigation Bar */}
      <div
        style={{
          height: 64,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: 24,
        }}
      >
        {/* Logo placeholder */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: ACCENT_COLOR,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>R</span>
        </div>

        {/* Nav items - Payroll is now active */}
        <div style={{ display: "flex", gap: 24 }}>
          {["Home", "Payroll", "Benefits", "Time Off", "Documents"].map((item, i) => (
            <span
              key={i}
              style={{
                fontSize: 15,
                fontWeight: item === "Payroll" ? 600 : 400,
                color: item === "Payroll" ? "#1F2937" : "#6B7280",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                cursor: "pointer",
              }}
            >
              {item}
            </span>
          ))}
        </div>

        {/* User avatar on right */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 14, color: "#6B7280" }}>JD</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          padding: "32px 48px",
          transform: `translateY(${contentY + floatOffset * 0.3}px)`,
          opacity: contentOpacity,
          transition: "none",
        }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#1F2937",
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Payroll Settings
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#6B7280",
              margin: "8px 0 0 0",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Manage your payment preferences and tax information.
          </p>
        </div>

        {/* Sections Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Pay History Section */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: "20px 24px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 20 }}>📋</span>
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#1F2937",
                      margin: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Pay History
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      margin: "4px 0 0 0",
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    View your past paystubs and earnings
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 14, color: ACCENT_COLOR, fontWeight: 500 }}>View →</span>
            </div>
          </div>

          {/* Tax Documents Section */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: "20px 24px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 20 }}>📄</span>
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#1F2937",
                      margin: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Tax Documents
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      margin: "4px 0 0 0",
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    W-2s, 1099s, and tax withholdings
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 14, color: ACCENT_COLOR, fontWeight: 500 }}>View →</span>
            </div>
          </div>

          {/* Direct Deposit Section - HIGHLIGHTED */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: "20px 24px",
              border: showHighlight ? `2px solid ${ACCENT_COLOR}` : "1px solid #E5E7EB",
              boxShadow: showHighlight
                ? `0 0 0 4px rgba(139, 92, 246, ${highlightOpacity})`
                : "none",
              position: "relative",
              transition: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: showHighlight ? `rgba(139, 92, 246, 0.1)` : "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "none",
                  }}
                >
                  <span style={{ fontSize: 20 }}>🏦</span>
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#1F2937",
                      margin: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Direct Deposit
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      margin: "4px 0 0 0",
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Chase Bank ****1234 • Checking
                  </p>
                </div>
              </div>
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: showHighlight ? ACCENT_COLOR : "#F3F4F6",
                  color: showHighlight ? "#FFFFFF" : ACCENT_COLOR,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  transition: "none",
                }}
              >
                Edit
              </button>
            </div>
          </div>

          {/* Withholdings Section */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: "20px 24px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 20 }}>📊</span>
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#1F2937",
                      margin: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Withholdings
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      margin: "4px 0 0 0",
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Federal and state tax elections
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 14, color: ACCENT_COLOR, fontWeight: 500 }}>View →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
