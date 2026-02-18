"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useRef, useState } from "react";

export interface MetadataItem {
  label: string;
  value: React.ReactNode;
  /** Span 2 columns (useful for long values like URLs). Default: 1 */
  colSpan?: 1 | 2;
  /** Allow value to wrap instead of truncating. Default: false */
  allowWrap?: boolean;
  /** Tooltip text to show on hover (defaults to value if it's a string) */
  tooltip?: string;
}

interface MetadataStripProps {
  items: MetadataItem[];
  /** Number of grid columns. Default: 2 */
  columns?: 2 | 3 | 4;
  /** Additional class names on the outer wrapper */
  className?: string;
}

/**
 * A truncated value that shows a tooltip only when content is actually overflowing.
 */
function TruncatedValue({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip?: string;
}) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  const checkOverflow = useCallback(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, []);

  // If no tooltip text provided, just render truncated without tooltip
  if (!tooltip) {
    return (
      <span ref={textRef} className="truncate block">
        {children}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          className="truncate block cursor-default"
          onMouseEnter={checkOverflow}
        >
          {children}
        </span>
      </TooltipTrigger>
      {isOverflowing && (
        <TooltipContent className="max-w-xs break-all">
          {tooltip}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

/**
 * Compact key-value metadata row rendered inside a bordered card.
 * Used in detail pages to display source/action attributes.
 */
export function MetadataStrip({
  items,
  columns = 2,
  className,
}: MetadataStripProps) {
  const colsClass =
    columns === 4
      ? "grid-cols-1 xs:grid-cols-2 lg:grid-cols-4"
      : columns === 3
        ? "grid-cols-1 xs:grid-cols-2 md:grid-cols-3"
        : "grid-cols-1 xs:grid-cols-2";

  return (
    <div className={cn("rounded-lg border bg-card p-4 overflow-hidden", className)}>
      <dl className={cn("grid gap-x-6 gap-y-3 text-sm", colsClass)}>
        {items.map((item) => {
          const tooltipText = item.tooltip ?? (typeof item.value === "string" ? item.value : undefined);
          
          return (
            <div
              key={item.label}
              className={cn(
                "min-w-0", // Enable text truncation in grid items
                item.colSpan === 2 && "xs:col-span-2"
              )}
            >
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-medium mt-0.5">
                {item.allowWrap ? (
                  item.value
                ) : (
                  <TruncatedValue tooltip={tooltipText}>
                    {item.value}
                  </TruncatedValue>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
