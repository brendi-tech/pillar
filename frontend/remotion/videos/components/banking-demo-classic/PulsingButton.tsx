import { interpolate } from "remotion";

type PulsingButtonProps = {
  frame: number;
  text: string;
  pulseColor?: string;
  backgroundColor?: string;
};

export const PulsingButton = ({
  frame,
  text,
  pulseColor = "#22C55E",
  backgroundColor = "#22C55E",
}: PulsingButtonProps) => {
  // Continuous pulse animation every 45 frames
  const pulseProgress = frame % 45;
  const glowRadius = interpolate(pulseProgress, [0, 45], [0, 12]);
  const glowOpacity = interpolate(pulseProgress, [0, 45], [0.4, 0]);

  return (
    <div
      style={{
        backgroundColor,
        borderRadius: 14,
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: `0 0 0 ${glowRadius}px ${pulseColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')}`,
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
        {text}
      </span>
    </div>
  );
};
