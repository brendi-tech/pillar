import { Search, Zap } from "lucide-react";

import type { EmptyStateProps } from "./ToolsSidebar.types";

export function EmptyState({ searchTerm, hasAnyTools }: EmptyStateProps) {
  if (searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No tools match &quot;{searchTerm}&quot;
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Try a different search term
        </p>
      </div>
    );
  }

  if (!hasAnyTools) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Zap className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="mb-3 text-sm text-muted-foreground">
          No tools synced yet
        </p>
        <p className="text-xs text-muted-foreground/60">
          Define tools in your client code and deploy to sync them.
        </p>
      </div>
    );
  }

  return null;
}
