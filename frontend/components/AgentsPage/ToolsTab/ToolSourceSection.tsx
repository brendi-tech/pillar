import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Circle, CircleMinus, RefreshCw } from "lucide-react";
import type { ToolSourceSectionProps } from "./ToolsTab.types";

export function ToolSourceSection({
  icon,
  title,
  count,
  enabledCount,
  selectionState,
  onSelectAll,
  expanded,
  onToggleExpanded,
  healthDot,
  refreshing,
  onRefresh,
  authAction,
  contextColumnHeaders,
  children,
}: ToolSourceSectionProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggleExpanded}>
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>

        {selectionState === "all" ? (
          <Checkbox
            checked={true}
            onCheckedChange={() => onSelectAll(false)}
            className="h-4 w-4 mr-2 shrink-0 border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-background"
            aria-label={`Deselect all ${title}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelectAll(true)}
            className="mr-2 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Select all ${title}`}
          >
            {selectionState === "some" ? (
              <CircleMinus className="h-4 w-4 text-muted-foreground transition-colors" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 transition-colors" />
            )}
          </button>
        )}

        <div className="flex flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-sm min-w-0">
          {icon}
          <span className="font-medium truncate">{title}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {enabledCount !== undefined && enabledCount < count
              ? `${enabledCount}/${count}`
              : count}
          </span>
          {healthDot && (
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", healthDot)}
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {authAction}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  refreshing && "animate-spin"
                )}
              />
            </Button>
          )}
          {contextColumnHeaders && (
            <span className="text-[10px] font-medium text-muted-foreground tracking-wider ml-2 w-[110px] text-right">
              Available in:
            </span>
          )}
        </div>
      </div>

      <CollapsibleContent>
        <div className="ml-4 border-l pl-2 py-1 space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
