import { cn } from "@/lib/utils";

export interface DashedConnectorProps {
  /** Direction of the connector */
  direction: "vertical" | "horizontal";
  /** Length of the connector in pixels */
  length: number;
  /** Show dot at the start of the line */
  startDot?: boolean;
  /** Show dot at the end of the line */
  endDot?: boolean;
  /** Size of the dots in pixels */
  dotSize?: number;
  /** Color of the line and dots */
  color?: string;
  /** Dash pattern [dash, gap] */
  dashPattern?: [number, number];
  /** Additional className for the container */
  className?: string;
}

/**
 * DashedConnector - An SVG-based dashed line with optional dots on either end
 *
 * @example
 * // Vertical connector with dots on both ends
 * <DashedConnector direction="vertical" length={100} startDot endDot />
 *
 * // Horizontal connector with only end dot
 * <DashedConnector direction="horizontal" length={50} endDot />
 */
export function DashedConnector({
  direction,
  length,
  startDot = false,
  endDot = false,
  dotSize = 6,
  color = "#A5A5A5",
  dashPattern = [2, 2],
  className,
}: DashedConnectorProps) {
  const isVertical = direction === "vertical";
  const strokeWidth = 1;

  // Calculate SVG dimensions with padding for dots
  const padding = dotSize / 2;
  const width = isVertical ? dotSize : length + dotSize;
  const height = isVertical ? length + dotSize : dotSize;

  // Calculate line coordinates
  const x1 = isVertical ? dotSize / 2 : padding;
  const y1 = isVertical ? padding : dotSize / 2;
  const x2 = isVertical ? dotSize / 2 : length + padding;
  const y2 = isVertical ? length + padding : dotSize / 2;

  return (
    <svg
      width={width}
      height={height}
      className={cn("pointer-events-none", className)}
      style={{ overflow: "visible" }}
    >
      {/* Dashed line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashPattern.join(" ")}
      />

      {/* Start dot */}
      {startDot && <circle cx={x1} cy={y1} r={dotSize / 2} fill={color} />}

      {/* End dot */}
      {endDot && <circle cx={x2} cy={y2} r={dotSize / 2} fill={color} />}
    </svg>
  );
}

export interface DashedPathConnectorProps {
  /** SVG path data (d attribute) */
  path: string;
  /** Show dot at the start of the path */
  startDot?: boolean;
  /** Show dot at the end of the path */
  endDot?: boolean;
  /** Position of start dot [x, y] */
  startPosition?: [number, number];
  /** Position of end dot [x, y] */
  endPosition?: [number, number];
  /** Size of the dots in pixels */
  dotSize?: number;
  /** Color of the line and dots */
  color?: string;
  /** Dash pattern [dash, gap] */
  dashPattern?: [number, number];
  /** Width of the SVG viewBox */
  width: number;
  /** Height of the SVG viewBox */
  height: number;
  /** Additional className for the container */
  className?: string;
}

/**
 * DashedPathConnector - An SVG-based dashed path with optional dots
 * Use this for more complex paths (L-shapes, curves, etc.)
 *
 * @example
 * // L-shaped connector
 * <DashedPathConnector
 *   path="M 10 10 L 10 50 L 50 50"
 *   width={60}
 *   height={60}
 *   startDot
 *   endDot
 *   startPosition={[10, 10]}
 *   endPosition={[50, 50]}
 * />
 */
export function DashedPathConnector({
  path,
  startDot = false,
  endDot = false,
  startPosition,
  endPosition,
  dotSize = 6,
  color = "#A5A5A5",
  dashPattern = [2, 2],
  width,
  height,
  className,
}: DashedPathConnectorProps) {
  return (
    <svg
      width={width}
      height={height}
      className={cn("pointer-events-none", className)}
      style={{ overflow: "visible" }}
    >
      {/* Dashed path */}
      <path
        d={path}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={dashPattern.join(" ")}
        fill="none"
      />

      {/* Start dot */}
      {startDot && startPosition && (
        <circle
          cx={startPosition[0]}
          cy={startPosition[1]}
          r={dotSize / 2}
          fill={color}
        />
      )}

      {/* End dot */}
      {endDot && endPosition && (
        <circle
          cx={endPosition[0]}
          cy={endPosition[1]}
          r={dotSize / 2}
          fill={color}
        />
      )}
    </svg>
  );
}
