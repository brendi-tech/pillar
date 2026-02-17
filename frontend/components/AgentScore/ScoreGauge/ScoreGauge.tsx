"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface ScoreGaugeProps {
  score: number | null;
  size: "lg" | "md" | "sm";
  label?: string;
  animated?: boolean;
  /** Show a spinning loading state instead of a score. */
  loading?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#0CCE6B";
  if (score >= 50) return "#FFA400";
  return "#FF4E42";
}

/**
 * Lighthouse-style circular score gauge.
 * Uses SVG stroke-dasharray for the arc fill and rAF for number animation.
 *
 * When `loading` is true, a partial arc spins continuously in the brand
 * orange color with a subtle spinner icon in the center.
 */
export function ScoreGauge({ score, size, label, animated = true, loading = false }: ScoreGaugeProps) {
  const isNull = score === null;
  const effectiveScore = score ?? 0;
  const [displayScore, setDisplayScore] = useState<number | null>(animated ? 0 : effectiveScore);
  const [mounted, setMounted] = useState(!animated);
  const rafRef = useRef<number | null>(null);

  const svgSize = size === "lg" ? 180 : size === "md" ? 120 : 80;
  const strokeWidth = size === "lg" ? 8 : size === "md" ? 6 : 5;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Leave a small gap at the bottom of the circle for the gauge look
  const gapFraction = 0.15;
  const arcLength = circumference * (1 - gapFraction);
  const rotation = 90 + (360 * gapFraction) / 2; // Rotate so gap is at bottom

  // Compute how much of the arc should be filled (proportional to score)
  const filledArc = isNull ? 0 : arcLength * (effectiveScore / 100);
  const animatedFill = animated && !mounted ? 0 : filledArc;
  const color = isNull ? "#9A9A9A" : getScoreColor(effectiveScore);

  // Loading state: ~30% of the arc, brand orange
  const loadingArcLength = arcLength * 0.3;

  // Animate mount
  useEffect(() => {
    if (!animated) return;
    // Small delay so the CSS transition triggers
    const timeout = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timeout);
  }, [animated]);

  // Animate number count-up
  useEffect(() => {
    if (loading || isNull) {
      setDisplayScore(null);
      return;
    }
    if (!animated) {
      setDisplayScore(effectiveScore);
      return;
    }
    if (!mounted) return;

    const duration = 1200;
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(from + (effectiveScore - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effectiveScore, isNull, animated, mounted, loading]);

  const loaderIconSize = size === "lg" ? "xl" : size === "md" ? "lg" : "sm";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="block"
        >
          {/* Background arc */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#E8E4DC"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            transform={`rotate(${rotation} ${svgSize / 2} ${svgSize / 2})`}
          />

          {loading ? (
            /* Spinning arc for loading state */
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke="#FF6E00"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${loadingArcLength} ${circumference - loadingArcLength}`}
              className="animate-[gauge-spin_1.4s_linear_infinite]"
              style={{ transformOrigin: "center" }}
            />
          ) : (
            /* Score arc — fill from start by varying dash length */
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${animatedFill} ${circumference}`}
              transform={`rotate(${rotation} ${svgSize / 2} ${svgSize / 2})`}
              style={{
                transition: animated ? "stroke-dasharray 1.2s ease-out" : "none",
              }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {loading ? (
            <Spinner size={loaderIconSize as "sm" | "lg" | "xl"} className="text-[#FF6E00]" />
          ) : (
            <span
              className={cn(
                "font-mono font-bold tabular-nums",
                size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl"
              )}
              style={{ color }}
            >
              {displayScore === null ? "—" : displayScore}
            </span>
          )}
        </div>
      </div>
      {label && (
        <span
          className={cn(
            "text-[#6B6B6B] font-medium text-center",
            size === "lg" ? "text-base mt-1" : size === "md" ? "text-sm mt-1" : "text-xs"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
