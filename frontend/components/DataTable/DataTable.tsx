"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/ui/table-skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  centered?: boolean;
  headerClassName?: string;
  cell: (row: T) => ReactNode;
  cellClassName?: string;
  skeletonWidth?: string;
}

interface InfiniteScrollConfig {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

interface EmptyStateConfig {
  icon?: ReactNode;
  title: string;
  description?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRowClick?: (row: T) => void;
  /** Override default row rendering for full control over <TableRow>/<TableCell> output. */
  renderRow?: (row: T) => ReactNode;
  /** Extra rows appended after the data rows (e.g. invitation rows with different shape). */
  extraRows?: ReactNode;
  infiniteScroll?: InfiniteScrollConfig;
  emptyState?: EmptyStateConfig;
  errorMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  isError,
  onRowClick,
  renderRow,
  extraRows,
  infiniteScroll,
  emptyState,
  errorMessage = "Failed to load data",
  className,
}: DataTableProps<T>) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infiniteScroll) return;
    const el = sentinelRef.current;
    if (!el) return;

    const { hasNextPage, isFetchingNextPage, onLoadMore } = infiniteScroll;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [infiniteScroll]);

  if (isLoading) {
    const skeletonColumns: TableSkeletonColumn[] = columns.map((col) => ({
      header: typeof col.header === "string" ? col.header : col.id,
      width: col.width,
      cellWidth: col.skeletonWidth,
      centered: col.centered,
    }));
    return <TableSkeleton columns={skeletonColumns} className={className} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p>{errorMessage}</p>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        {emptyState.icon}
        <p>{emptyState.title}</p>
        {emptyState.description && (
          <p className="text-sm">{emptyState.description}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-auto rounded-md border max-h-full", className)}
    >
      <table className="w-full caption-bottom text-xs md:text-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-background hover:bg-background">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  "bg-background",
                  col.width,
                  col.centered && "text-center",
                  col.headerClassName
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) =>
            renderRow ? (
              renderRow(row)
            ) : (
              <TableRow
                key={keyExtractor(row)}
                className={cn(
                  onRowClick && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      col.centered && "text-center",
                      col.cellClassName
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          )}
          {extraRows}
        </TableBody>
      </table>

      {infiniteScroll && (
        <>
          <div ref={sentinelRef} className="h-1" />
          {infiniteScroll.isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
