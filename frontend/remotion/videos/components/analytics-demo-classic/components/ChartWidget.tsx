import { interpolate, spring } from "remotion";

type ChartWidgetProps = {
  frame: number;
  fps: number;
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  isNew?: boolean;
  entranceFrame?: number;
  chartColor?: string;
};

// Mini sparkline data
const SPARKLINE_DATA = {
  revenue: [30, 45, 38, 52, 48, 65, 58, 72],
  users: [120, 135, 128, 145, 155, 148, 162, 175],
  signups: [45, 52, 48, 61, 58, 72, 68, 85],
};

const MiniSparkline = ({
  data,
  color,
  width = 120,
  height = 40,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) => {
  const padding = 4;
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  
  const xStep = (width - padding * 2) / (data.length - 1);
  
  const points = data.map((value, index) => {
    const x = padding + index * xStep;
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const ChartWidget = ({
  frame,
  fps,
  title,
  value,
  change,
  changePositive = true,
  isNew = false,
  entranceFrame = 0,
  chartColor = "#22C55E",
}: ChartWidgetProps) => {
  // Entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 150 },
  });
  
  const scale = interpolate(entranceProgress, [0, 1], [0.9, 1]);
  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  
  // New glow animation
  const glowIntensity = isNew
    ? interpolate(
        Math.sin((frame - entranceFrame) / 10) * 0.5 + 0.5,
        [0, 1],
        [0.3, 0.6]
      )
    : 0;
  
  // Get sparkline data based on title
  const sparklineData = title.toLowerCase().includes("revenue")
    ? SPARKLINE_DATA.revenue
    : title.toLowerCase().includes("user")
      ? SPARKLINE_DATA.users
      : SPARKLINE_DATA.signups;
  
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 24,
        boxShadow: isNew
          ? `0 4px 20px rgba(34, 197, 94, ${glowIntensity}), 0 2px 8px rgba(0, 0, 0, 0.08)`
          : "0 2px 8px rgba(0, 0, 0, 0.08)",
        border: isNew ? "2px solid #22C55E" : "1px solid #E5E0D8",
        transform: `scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transition: "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "#666666",
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {title}
            </h3>
            {isNew && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#22C55E",
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                }}
              >
                New
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#1A1A1A",
              margin: "8px 0 0 0",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {value}
          </p>
        </div>
        
        {/* Change indicator */}
        {change && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 8,
              backgroundColor: changePositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: changePositive ? "#22C55E" : "#EF4444",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {changePositive ? "↑" : "↓"} {change}
            </span>
          </div>
        )}
      </div>
      
      {/* Sparkline */}
      <div
        style={{
          marginTop: "auto",
        }}
      >
        <MiniSparkline data={sparklineData} color={chartColor} width={200} height={50} />
      </div>
    </div>
  );
};
