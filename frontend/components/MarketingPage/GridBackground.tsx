import { cn } from "@/lib/utils";

interface RadialGradient {
  /** Position X as percentage (e.g., "0%", "50%") or pixel value (e.g., "100px") */
  x: number | string;
  /** Position Y as percentage (e.g., "0%", "50%") or pixel value (e.g., "100px") */
  y: number | string;
  /** Radius of the gradient (CSS value like "50%", "200px", or "closest-side") */
  radius: string;
  /** Color that covers/hides the grid within this area (e.g., "white") */
  color: string;
}

interface GridBackgroundProps {
  /** Size of each grid square in pixels (default: 20) */
  gridSize?: number;
  /** Color of grid lines (default: "#C5C5C5") */
  lineColor?: string;
  /** Width of grid lines in pixels (default: 1) */
  lineWidth?: number;
  /** Array of radial gradients to overlay and fade/hide sections */
  gradients?: RadialGradient[];
  /** Additional className for the container */
  className?: string;
  /** Children to render on top of the grid */
  children?: React.ReactNode;
}

/**
 * GridBackground - A grid pattern background with configurable line color and radial gradient overlays
 *
 * The grid squares maintain a consistent size regardless of container dimensions.
 * Radial gradients can be used to fade/hide sections of the grid.
 */
export function GridBackground({
  gridSize = 20,
  lineColor = "#F7F7F7",
  lineWidth = 1,
  gradients = [],
  className,
  children,
}: GridBackgroundProps) {
  // Create the grid pattern using repeating linear gradients
  // Horizontal lines
  const horizontalLines = `repeating-linear-gradient(
    0deg,
    transparent,
    transparent ${gridSize - lineWidth}px,
    ${lineColor} ${gridSize - lineWidth}px,
    ${lineColor} ${gridSize}px
  )`;

  // Vertical lines
  const verticalLines = `repeating-linear-gradient(
    90deg,
    transparent,
    transparent ${gridSize - lineWidth}px,
    ${lineColor} ${gridSize - lineWidth}px,
    ${lineColor} ${gridSize}px
  )`;

  // Create radial gradient overlays
  const radialGradients = gradients.map((gradient) => {
    const x = typeof gradient.x === "number" ? `${gradient.x}px` : gradient.x;
    const y = typeof gradient.y === "number" ? `${gradient.y}px` : gradient.y;

    // Use ellipse for percentage-based radii, or circle for pixel/keyword values
    const isPercentage = gradient.radius.includes("%");
    const shape = isPercentage
      ? `ellipse ${gradient.radius} ${gradient.radius}`
      : `circle ${gradient.radius}`;

    return `radial-gradient(${shape} at ${x} ${y}, ${gradient.color} 0%, ${gradient.color} 70%, transparent 100%)`;
  });

  // Combine all backgrounds: gradients on top, then grid pattern
  const backgrounds = [...radialGradients, horizontalLines, verticalLines].join(
    ", "
  );

  return (
    <div
      className={cn("relative", className)}
      style={{
        background: backgrounds,
      }}
    >
      {children}
    </div>
  );
}
