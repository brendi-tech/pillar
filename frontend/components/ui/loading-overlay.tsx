import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isLoading: boolean;
  className?: string;
}

export function LoadingOverlay({ isLoading, className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 overflow-hidden pointer-events-none",
        "bg-white/30 dark:bg-gray-900/30 backdrop-blur-[1px]",
        className
      )}
    >
      <div
        className="absolute inset-0 animate-[overlay-shimmer_2s_ease-in-out_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}
