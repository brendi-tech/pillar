import { spring, interpolate } from "remotion";

type ToastNotificationProps = {
  frame: number;
  fps: number;
  entranceFrame: number;
  issueId: string;
  panelWidth: number;
};

export const ToastNotification = ({
  frame,
  fps,
  entranceFrame,
  issueId,
  panelWidth,
}: ToastNotificationProps) => {
  // Toast entrance animation - slides in from bottom-right
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const toastY = interpolate(entranceProgress, [0, 1], [100, 0]);
  const toastOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);

  // Toast exit animation - starts fading out after 60 frames (2 seconds)
  const exitStartFrame = entranceFrame + 60;
  const exitProgress = frame >= exitStartFrame
    ? interpolate(
        frame - exitStartFrame,
        [0, 30],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  const finalOpacity = toastOpacity * exitProgress;

  if (finalOpacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: 32,
        right: panelWidth + 32,
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: finalOpacity,
          transform: `translateY(${toastY}px)`,
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Toast content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1A1A1A",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Issue created
          </span>
          <span
            style={{
              fontSize: 13,
              color: "#6B7280",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <span
              style={{
                color: "#3B82F6",
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                fontWeight: 500,
              }}
            >
              {issueId}
            </span>
            {" "}added to Sprint 23
          </span>
        </div>

        {/* Close button */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            marginLeft: 8,
          }}
        >
          <span style={{ color: "#9CA3AF", fontSize: 14 }}>✕</span>
        </div>
      </div>
    </div>
  );
};
