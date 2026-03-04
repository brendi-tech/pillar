"use client";

import { cn } from "@/lib/utils";
import { deriveActionLabel } from "@/types/actions";
import Link from "next/link";

import type { ToolListItemProps } from "./ToolsSidebar.types";

export function ToolListItem({
  action,
  isSelected,
  onNavigate,
}: ToolListItemProps) {
  return (
    <Link
      href={`/tools/${action.id}`}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-3 sm:py-1.5 text-sm transition-colors",
        "hover:bg-muted",
        isSelected && "bg-muted font-medium"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate">{deriveActionLabel(action.name)}</div>
      </div>
      {action.status === "draft" && (
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Draft
        </span>
      )}
      {action.status === "archived" && (
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Archived
        </span>
      )}
    </Link>
  );
}
