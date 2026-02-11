"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";

interface DetailPageShellProps {
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

/**
 * Shared scroll wrapper for detail pages (actions, knowledge sources, etc.).
 * Handles loading skeleton, error card, and empty state before rendering children.
 */
export function DetailPageShell({
  isLoading,
  error,
  isEmpty,
  emptyTitle = "Not found",
  emptyDescription = "Select an item from the sidebar to view details.",
  onRetry,
  children,
}: DetailPageShellProps) {
  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/60 mb-4" />
        <p className="text-sm text-muted-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-6 p-6">{children}</div>
    </div>
  );
}
