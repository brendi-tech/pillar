import { spring, interpolate } from "remotion";

type HomeDashboardProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  opacity: number;
};

// HR-specific colors
const ACCENT_COLOR = "#8B5CF6"; // Purple

export const HomeDashboard = ({
  frame,
  fps,
  floatOffset,
  opacity,
}: HomeDashboardProps) => {
  // Subtle entrance animation
  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const contentY = interpolate(entranceProgress, [0, 1], [20, 0]);

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

        {/* Nav items */}
        <div style={{ display: "flex", gap: 24 }}>
          {["Home", "Payroll", "Benefits", "Time Off", "Documents"].map((item, i) => (
            <span
              key={i}
              style={{
                fontSize: 15,
                fontWeight: item === "Home" ? 600 : 400,
                color: item === "Home" ? "#1F2937" : "#6B7280",
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
          transition: "none",
        }}
      >
        {/* Welcome Header */}
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
            Welcome back, Jamie
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#6B7280",
              margin: "8px 0 0 0",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Here's what's happening with your account today.
          </p>
        </div>

        {/* Quick Actions Row */}
        <div style={{ display: "flex", gap: 20, marginBottom: 32 }}>
          {[
            { icon: "📅", label: "Request Time Off", desc: "4 days remaining" },
            { icon: "💰", label: "View Payroll", desc: "Next: Jan 31" },
            { icon: "❤️", label: "Benefits", desc: "Open enrollment" },
          ].map((action, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                padding: "20px 24px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 28, marginBottom: 8, display: "block" }}>
                {action.icon}
              </span>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1F2937",
                  margin: "0 0 4px 0",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {action.label}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#6B7280",
                  margin: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {action.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Employee Info Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            padding: "24px",
            border: "1px solid #E5E7EB",
            display: "flex",
            gap: 24,
            maxWidth: 600,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: "#E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 28, color: "#6B7280" }}>JD</span>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#1F2937",
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Jamie Davidson
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "#6B7280",
                margin: "4px 0 12px 0",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Senior Product Designer • Design Team
            </p>

            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Employee ID
                </span>
                <p
                  style={{
                    fontSize: 14,
                    color: "#1F2937",
                    margin: "4px 0 0 0",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  EMP-2847
                </p>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Start Date
                </span>
                <p
                  style={{
                    fontSize: 14,
                    color: "#1F2937",
                    margin: "4px 0 0 0",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Mar 15, 2022
                </p>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Location
                </span>
                <p
                  style={{
                    fontSize: 14,
                    color: "#1F2937",
                    margin: "4px 0 0 0",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  San Francisco, CA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
