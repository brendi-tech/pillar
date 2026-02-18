import { interpolate, spring } from "remotion";

type ToastNotificationProps = {
  frame: number;
  fps: number;
  entranceFrame: number;
  message: string;
};

export const ToastNotification = ({
  frame,
  fps,
  entranceFrame,
  message,
}: ToastNotificationProps) => {
  // Entrance animation - slide in from top
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 150 },
  });
  
  // Fade out after showing for a while
  const fadeOutStart = entranceFrame + 90; // 3 seconds after entrance
  const fadeOutProgress = interpolate(
    frame - fadeOutStart,
    [0, 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  
  const translateY = interpolate(entranceProgress, [0, 1], [-100, 0]);
  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]) * (1 - fadeOutProgress);
  
  if (opacity <= 0) return null;
  
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity,
        zIndex: 60,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 24px",
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
          border: "2px solid #22C55E",
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: "#22C55E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="16"
            height="16"
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
        
        {/* Message */}
        <span
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "#1A1A1A",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {message}
        </span>
      </div>
    </div>
  );
};
