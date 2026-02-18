import { interpolate, spring } from "remotion";

type DealDetailViewProps = {
  frame: number;
  fps: number;
  visible: boolean;
  entranceFrame: number;
  panelWidth: number;
};

// Timing for stage update
const STAGE_UPDATE_START = 314; // Aligned with extended search timing

export const DealDetailView = ({
  frame,
  fps,
  visible,
  entranceFrame,
  panelWidth,
}: DealDetailViewProps) => {
  // Entrance animation - faster slide in
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 15, stiffness: 350 }, // Faster entrance
  });

  const slideX = interpolate(entranceProgress, [0, 1], [100, 0]);
  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);

  // Stage update animation (Step 3)
  const stageUpdateProgress = spring({
    frame: Math.max(0, frame - STAGE_UPDATE_START),
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const isStageUpdated = frame >= STAGE_UPDATE_START;
  const stageFlashOpacity = interpolate(
    frame - STAGE_UPDATE_START,
    [0, 10, 30],
    [0, 0.4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 100, // Below top bar (2x scaled)
        left: 0, // No sidebar - starts at edge
        right: panelWidth, // Before co-pilot panel
        bottom: 0,
        backgroundColor: "#FFFFFF",
        transform: `translateX(${slideX}px)`,
        opacity,
        overflow: "visible",
        zIndex: 1, // Lower z-index so ImplementationForm appears on top
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 36px",
          borderBottom: "0.8px solid #E4E0D9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Back button */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              backgroundColor: "#F5F5F5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            ←
          </div>
          <div>
            <h2
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Enterprise License - Walmart
            </h2>
            <p
              style={{
                fontSize: 20,
                color: "#666666",
                margin: "6px 0 0 0",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Walmart Inc. • Jane D.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <button
            style={{
              padding: "12px 22px",
              backgroundColor: "#F5F5F5",
              border: "0.8px solid #E4E0D9",
              borderRadius: 10,
              fontSize: 18,
              color: "#666666",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Edit
          </button>
          <button
            style={{
              padding: "12px 24px",
              backgroundColor: "#1E293B",
              border: "none",
              borderRadius: 10,
              fontSize: 18,
              fontWeight: 500,
              color: "#FFFFFF",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Actions ▾
          </button>
        </div>
      </div>

      {/* Deal Details Content */}
      <div style={{ flex: 1, padding: 32, overflow: "visible" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            height: "100%",
          }}
        >
          {/* Left Column - Key Details */}
          <div
            style={{
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#666666",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: "0 0 24px 0",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Deal Information
            </h3>

            {/* Stage Field - This animates! */}
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                backgroundColor: isStageUpdated
                  ? `rgba(34, 197, 94, ${stageFlashOpacity})`
                  : "transparent",
                borderRadius: 10,
                border: isStageUpdated
                  ? `2px solid rgba(34, 197, 94, ${stageUpdateProgress * 0.5})`
                  : "2px solid transparent",
              }}
            >
              <label
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "#999999",
                  display: "block",
                  marginBottom: 8,
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Stage
              </label>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  backgroundColor: isStageUpdated
                    ? "rgba(34, 197, 94, 0.15)"
                    : "rgba(100, 116, 139, 0.15)",
                  borderRadius: 8,
                  transform: isStageUpdated
                    ? `scale(${interpolate(stageUpdateProgress, [0, 0.5, 1], [1, 1.1, 1])})`
                    : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: isStageUpdated ? "#22C55E" : "#64748B",
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {isStageUpdated ? "Closed Won ✓" : "Negotiation"}
                </span>
              </div>
            </div>

            {/* Other fields */}
            {[
              { label: "Value", value: "$425,000" },
              { label: "Close Date", value: "Jan 24, 2026" },
              { label: "Owner", value: "Jane D." },
              { label: "Probability", value: isStageUpdated ? "100%" : "75%" },
            ].map((field, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <label
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "#999999",
                    display: "block",
                    marginBottom: 6,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {field.label}
                </label>
                <span
                  style={{
                    fontSize: 24,
                    color: "#1A1A1A",
                    fontWeight: 500,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>

          {/* Right Column - Activity */}
          <div
            style={{
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              padding: 28,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#666666",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: "0 0 24px 0",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Recent Activity
            </h3>

            {[
              {
                icon: "📧",
                text: "Email sent to Sarah Chen, VP Procurement",
                time: "2 hours ago",
              },
              { icon: "📞", text: "Call with procurement team", time: "Yesterday" },
              { icon: "📝", text: "Proposal v3 shared", time: "3 days ago" },
            ].map((activity, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  marginBottom: 20,
                  paddingBottom: 20,
                  borderBottom: i < 2 ? "0.8px solid #E4E0D9" : "none",
                }}
              >
                <span style={{ fontSize: 26 }}>{activity.icon}</span>
                <div>
                  <p
                    style={{
                      fontSize: 20,
                      color: "#1A1A1A",
                      margin: 0,
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {activity.text}
                  </p>
                  <span
                    style={{
                      fontSize: 16,
                      color: "#999999",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {activity.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
