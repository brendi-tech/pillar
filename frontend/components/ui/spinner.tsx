import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "border";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ className, size = "md", variant = "icon" }: SpinnerProps) {
  if (variant === "border") {
    return (
      <div
        className={cn(
          "animate-spin rounded-full border-4 border-muted border-t-primary",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
    />
  );
}
