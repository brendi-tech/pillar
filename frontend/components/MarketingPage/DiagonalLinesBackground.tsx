import { cn } from "@/lib/utils";

interface DiagonalLinesBackgroundProps {
  /** Spacing between diagonal lines in pixels (default: 12) */
  lineSpacing?: number;
  /** Color of the diagonal lines (default: "#D4CFC7") */
  lineColor?: string;
  /** Width of the lines in pixels (default: 1) */
  lineWidth?: number;
  /** Background color behind the lines (default: "#EEEBE5") */
  backgroundColor?: string;
  /** Direction of lines: "left-to-right" (top-left to bottom-right) or "right-to-left" (top-right to bottom-left) */
  direction?: "left-to-right" | "right-to-left";
  /** Additional className for the container */
  className?: string;
  /** Children to render on top of the background */
  children?: React.ReactNode;
}

/**
 * DiagonalLinesBackground - A diagonal line pattern background with configurable line color and spacing
 *
 * The line spacing maintains a consistent size regardless of container dimensions.
 */
export function DiagonalLinesBackground({
  lineSpacing = 12,
  lineColor = "#D4CFC7",
  lineWidth = 1,
  backgroundColor = "#EEEBE5",
  direction = "left-to-right",
  className,
  children,
}: DiagonalLinesBackgroundProps) {
  // Calculate angle based on direction
  // left-to-right = 135deg (lines go from top-left to bottom-right)
  // right-to-left = 45deg (lines go from top-right to bottom-left)
  const angle = direction === "left-to-right" ? 135 : 45;

  // Create the diagonal line pattern using repeating linear gradient
  // Starting with line color at 0px for more consistent rendering
  const diagonalLines = `repeating-linear-gradient(
    ${angle}deg,
    ${lineColor} 0px,
    ${lineColor} ${lineWidth}px,
    ${backgroundColor} ${lineWidth}px,
    ${backgroundColor} ${lineSpacing}px
  )`;

  return (
    <div
      className={cn("relative", className)}
      style={{
        background: diagonalLines,
      }}
    >
      {children}
    </div>
  );
}
