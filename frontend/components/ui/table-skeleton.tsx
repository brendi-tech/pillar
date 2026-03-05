"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface TableSkeletonColumn {
  header: string;
  width?: string;
  cellWidth?: string;
  centered?: boolean;
}

interface TableSkeletonProps {
  columns: TableSkeletonColumn[];
  rows?: number;
  className?: string;
}

export function TableSkeleton({
  columns,
  rows = 8,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("overflow-auto rounded-md border h-full", className)}>
      <table className="w-full caption-bottom text-xs md:text-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-background hover:bg-background">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                className={cn(
                  "bg-background",
                  col.width,
                  col.centered && "text-center"
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col, colIndex) => (
                <TableCell
                  key={colIndex}
                  className={cn(col.centered && "text-center")}
                >
                  <Skeleton
                    className={cn(
                      "h-4",
                      col.cellWidth || "w-full",
                      col.centered && "mx-auto"
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
