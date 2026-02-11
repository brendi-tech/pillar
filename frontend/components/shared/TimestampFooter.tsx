"use client";

import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

interface TimestampFooterProps {
  createdAt: string;
  updatedAt: string;
  /** Additional timestamp entries (e.g. "Confirmed", "Last executed") */
  extras?: { label: string; date: string }[];
}

/**
 * Separator + relative timestamp footer for detail pages.
 */
export function TimestampFooter({
  createdAt,
  updatedAt,
  extras,
}: TimestampFooterProps) {
  return (
    <>
      <Separator />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Created{" "}
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </span>
        <span>
          Updated{" "}
          {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
        </span>
        {extras?.map((extra) => (
          <span key={extra.label}>
            {extra.label}{" "}
            {formatDistanceToNow(new Date(extra.date), { addSuffix: true })}
          </span>
        ))}
      </div>
    </>
  );
}
