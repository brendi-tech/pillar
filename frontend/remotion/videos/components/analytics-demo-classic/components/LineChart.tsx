import { interpolate, spring } from "remotion";
import { useEffect, useRef, useState } from "react";

type LineChartProps = {
  frame: number;
  fps: number;
  drawStartFrame: number;
  morphStartFrame?: number;
  isWeekly?: boolean;
  width?: number;
  height?: number;
  showLabels?: boolean;
  mini?: boolean;
};

// Sample data - daily signups (trending upward)
const DAILY_DATA = [45, 52, 48, 61, 58, 72, 68, 85, 79, 94, 88, 102, 95, 110];

// Weekly aggregated data (fewer points, larger intervals)
const WEEKLY_DATA = [145, 191, 232, 283, 293, 315];

// Generate SVG path from data points
const generateLinePath = (
  data: number[],
  width: number,
  height: number,
  padding: number
) => {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  
  const xStep = (width - padding * 2) / (data.length - 1);
  
  const points = data.map((value, index) => {
    const x = padding + index * xStep;
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return { x, y };
  });
  
  // Create smooth curve path using quadratic bezier
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    path += ` Q ${prev.x + (curr.x - prev.x) * 0.5} ${prev.y}, ${cpX} ${(prev.y + curr.y) / 2}`;
    if (i === points.length - 1) {
      path += ` T ${curr.x} ${curr.y}`;
    }
  }
  
  // Simpler path for smoother animation
  path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  return { path, points };
};

export const LineChart = ({
  frame,
  fps,
  drawStartFrame,
  morphStartFrame = 9999,
  isWeekly = false,
  width = 600,
  height = 300,
  showLabels = true,
  mini = false,
}: LineChartProps) => {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  
  const padding = mini ? 20 : 50;
  const data = isWeekly ? WEEKLY_DATA : DAILY_DATA;
  const { path, points } = generateLinePath(data, width, height, padding);
  
  // Get path length after mount
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [path]);
  
  // Draw animation progress
  const drawProgress = interpolate(
    frame - drawStartFrame,
    [0, 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  
  // Morph animation for switching to weekly
  const morphProgress = frame >= morphStartFrame
    ? spring({
        frame: frame - morphStartFrame,
        fps,
        config: { damping: 20, stiffness: 100 },
      })
    : 0;
  
  // Calculate stroke dash offset for drawing animation
  const strokeDashoffset = pathLength * (1 - drawProgress);
  
  // X-axis labels
  const xLabels = isWeekly
    ? ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  return (
    <div
      style={{
        width,
        height: height + (showLabels ? 40 : 0),
        position: "relative",
      }}
    >
      <svg
        width={width}
        height={height}
        style={{
          overflow: "visible",
        }}
      >
        {/* Grid lines */}
        {!mini && (
          <>
            {[0.25, 0.5, 0.75].map((ratio, i) => (
              <line
                key={i}
                x1={padding}
                y1={height - padding - (height - padding * 2) * ratio}
                x2={width - padding}
                y2={height - padding - (height - padding * 2) * ratio}
                stroke="#E5E0D8"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}
          </>
        )}
        
        {/* Gradient fill under the line */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        
        {/* Fill area under the line */}
        {drawProgress > 0 && (
          <path
            d={`${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
            fill="url(#chartGradient)"
            opacity={drawProgress}
          />
        )}
        
        {/* Main line */}
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="#22C55E"
          strokeWidth={mini ? 2 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength || 1000}
          strokeDashoffset={strokeDashoffset}
        />
        
        {/* Data points */}
        {!mini && points.map((point, index) => {
          const pointProgress = interpolate(
            drawProgress,
            [index / points.length, (index + 0.3) / points.length],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          
          return (
            <g key={index}>
              {/* Outer glow */}
              <circle
                cx={point.x}
                cy={point.y}
                r={8}
                fill="#22C55E"
                opacity={0.2 * pointProgress}
              />
              {/* Inner circle */}
              <circle
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#FFFFFF"
                stroke="#22C55E"
                strokeWidth={2}
                opacity={pointProgress}
                style={{
                  transform: `scale(${pointProgress})`,
                  transformOrigin: `${point.x}px ${point.y}px`,
                }}
              />
            </g>
          );
        })}
        
        {/* X-axis line */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#E5E0D8"
          strokeWidth={1}
        />
        
        {/* Y-axis line */}
        {!mini && (
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#E5E0D8"
            strokeWidth={1}
          />
        )}
      </svg>
      
      {/* X-axis labels */}
      {showLabels && !mini && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingLeft: padding,
            paddingRight: padding,
            marginTop: 8,
          }}
        >
          {xLabels.slice(0, data.length).map((label, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                color: "#666666",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
