"use client";

import { cn } from "@/lib/utils";

export interface MetadataItem {
  label: string;
  value: React.ReactNode;
  /** Span 2 columns (useful for long values like URLs). Default: 1 */
  colSpan?: 1 | 2;
}

interface MetadataStripProps {
  items: MetadataItem[];
  /** Number of grid columns. Default: 2 */
  columns?: 2 | 3 | 4;
  /** Additional class names on the outer wrapper */
  className?: string;
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
      ? "grid-cols-2 sm:grid-cols-4"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <dl className={cn("grid gap-x-6 gap-y-3 text-sm", colsClass)}>
        {items.map((item) => (
          <div
            key={item.label}
            className={item.colSpan === 2 ? "col-span-2" : undefined}
          >
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-medium mt-0.5">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
