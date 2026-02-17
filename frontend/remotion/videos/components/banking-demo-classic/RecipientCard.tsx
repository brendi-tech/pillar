import { interpolate, spring } from "remotion";

type RecipientCardProps = {
  frame: number;
  fps: number;
  appearFrame: number;
  accentColor: string;
};

export const RecipientCard = ({
  frame,
  fps,
  appearFrame,
  accentColor,
}: RecipientCardProps) => {
  // Card entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - appearFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const slideX = interpolate(entranceProgress, [0, 1], [30, 0]);
  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);

  // Maria Santos selection animation (happens shortly after card appears)
  const selectionDelay = 15;
  const selectionProgress = spring({
    frame: Math.max(0, frame - (appearFrame + selectionDelay)),
    fps,
    config: { damping: 15, stiffness: 250 },
  });

  const mariaHighlightBg = interpolate(
    selectionProgress,
    [0, 1],
    [0, 1]
  );

  const checkmarkScale = interpolate(
    selectionProgress,
    [0, 0.5, 1],
    [0, 1.2, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${slideX}px)`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>🔍</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#64748B",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Found matching payees:
          </span>
        </div>

        {/* Recipients */}
        <div style={{ padding: 8 }}>
          {/* Maria Santos - highlighted/selected */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              backgroundColor: `rgba(59, 130, 246, ${0.08 * mariaHighlightBg})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              border: mariaHighlightBg > 0.5 
                ? `1.5px solid ${accentColor}` 
                : "1.5px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                👤
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#1A1A1A",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Sarah Chen
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748B",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Cleaner · Last paid Dec 15
                </div>
              </div>
            </div>

            {/* Checkmark */}
            {selectionProgress > 0.1 && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "#22C55E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${checkmarkScale})`,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          {/* CleanPro Services - not selected */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: 0.6,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              🏢
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#1A1A1A",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                CleanPro Services
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#64748B",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Business · Last paid Nov 2
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
