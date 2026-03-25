import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search } from "lucide-react";
import type { ToolsHeaderProps } from "./ToolsTab.types";

export function ToolsHeader({
  searchQuery,
  onSearchChange,
  enabledCount,
  totalCount,
  onEnableAll,
  onDisableAll,
  hasNoTools,
}: ToolsHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
          {enabledCount} of {totalCount} enabled
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onEnableAll}
            disabled={enabledCount === totalCount}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onDisableAll}
            disabled={enabledCount === 0}
          >
            Disable All
          </Button>
        </div>
      </div>

      {hasNoTools && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This agent has no tools enabled and won&apos;t be able to perform
            any actions.
          </span>
        </div>
      )}
    </div>
  );
}
