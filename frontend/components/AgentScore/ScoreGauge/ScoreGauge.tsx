"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size: "lg" | "md" | "sm";
  label?: string;
  animated?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#0CCE6B";
  if (score >= 50) return "#FFA400";
  return "#FF4E42";
}

/**
 * Lighthouse-style circular score gauge.
 * Uses SVG stroke-dasharray for the arc fill and rAF for number animation.
 */
export function ScoreGauge({ score, size, label, animated = true }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
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
  const filledArc = arcLength * (score / 100);
  const animatedFill = animated && !mounted ? 0 : filledArc;
  const color = getScoreColor(score);

  // Animate mount
  useEffect(() => {
    if (!animated) return;
    // Small delay so the CSS transition triggers
    const timeout = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timeout);
  }, [animated]);

  // Animate number count-up
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
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
      setDisplayScore(Math.round(from + (score - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score, animated, mounted]);

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
          {/* Score arc — fill from start by varying dash length */}
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
        </svg>
        {/* Score number centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-mono font-bold tabular-nums",
              size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl"
            )}
            style={{ color }}
          >
            {displayScore}
          </span>
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
