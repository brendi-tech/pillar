"use client";

import { BookOpen } from "lucide-react";

/**
 * Empty state component for when nothing is selected
 */
export function ContentEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-6" />
      <h3 className="text-lg font-medium text-foreground mb-2">
        No Source Selected
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Select a knowledge source from the sidebar to view its settings and
        sync history.
      </p>
    </div>
  );
}
