"use client";

import type { BillingInterval } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

interface BillingIntervalToggleProps {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  variant?: "light" | "dark";
}

export function BillingIntervalToggle({
  interval,
  onChange,
  variant = "light",
}: BillingIntervalToggleProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full p-1 text-sm",
        isDark ? "bg-white/10" : "bg-muted"
      )}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
          interval === "monthly"
            ? isDark
              ? "bg-white text-[#000622] shadow-sm"
              : "bg-background text-foreground shadow-sm"
            : isDark
              ? "text-white/60 hover:text-white/80"
              : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "relative rounded-full px-4 py-1.5 text-sm font-medium transition-all",
          interval === "yearly"
            ? isDark
              ? "bg-white text-[#000622] shadow-sm"
              : "bg-background text-foreground shadow-sm"
            : isDark
              ? "text-white/60 hover:text-white/80"
              : "text-muted-foreground hover:text-foreground"
        )}
      >
        Yearly
        <span
          className={cn(
            "ml-1.5 translate-y-[-2px] inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            interval === "yearly"
              ? "bg-emerald-500/15 text-emerald-600"
              : isDark
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-emerald-500/15 text-emerald-600"
          )}
        >
          -20%
        </span>
      </button>
    </div>
  );
}
