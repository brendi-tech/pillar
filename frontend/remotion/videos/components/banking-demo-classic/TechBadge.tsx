import { interpolate, spring } from "remotion";

type TechBadgeProps = {
  text: string;
  frame: number;
  fps: number;
  appearFrame: number;
};

export const TechBadge = ({
  text,
  frame,
  fps,
  appearFrame,
}: TechBadgeProps) => {
  // Badge fades in over 8 frames after step completion
  const entranceProgress = spring({
    frame: Math.max(0, frame - appearFrame),
    fps,
    config: { damping: 200 }, // Subtle entrance
  });

  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  const translateY = interpolate(entranceProgress, [0, 1], [4, 0]);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        marginTop: 4,
        marginLeft: 36, // Align with step text (after indicator)
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: '"SF Mono", "Fira Code", "Monaco", monospace',
          fontSize: 12,
          color: "#64748B", // Slate gray
          backgroundColor: "rgba(100, 116, 139, 0.08)", // Very subtle background
          borderRadius: 4,
          padding: "4px 8px",
          letterSpacing: 0.3,
        }}
      >
        {text}
      </span>
    </div>
  );
};
