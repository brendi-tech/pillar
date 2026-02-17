import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
type SpinnerVariant = "icon" | "border";

interface SpinnerProps {
  /** Additional classes to apply */
  className?: string;
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Visual style - icon (Loader2) or border (CSS spinner) */
  variant?: SpinnerVariant;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const borderWidthClasses: Record<SpinnerSize, string> = {
  xs: "border-2",
  sm: "border-2",
  md: "border-2",
  lg: "border-4",
  xl: "border-4",
};

export function Spinner({
  className,
  size = "sm",
  variant = "icon",
}: SpinnerProps) {
  if (variant === "border") {
    return (
      <div
        className={cn(
          "animate-spin rounded-full border-muted border-t-primary",
          sizeClasses[size],
          borderWidthClasses[size],
          className
        )}
      />
    );
  }

  return (
    <Loader2
      className={cn(
        "animate-spin text-muted-foreground shrink-0",
        sizeClasses[size],
        className
      )}
    />
  );
}
