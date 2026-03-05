"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, MessageSquare, Users } from "lucide-react";
import { useEffect, useRef } from "react";

import { Spinner } from "@/components/ui/spinner";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/ui/table-skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Visitor } from "@/lib/admin/visitors-api";

const USERS_TABLE_COLUMNS: TableSkeletonColumn[] = [
  { header: "Visitor ID", width: "w-[120px]", cellWidth: "w-20" },
  { header: "User ID", width: "w-[140px]", cellWidth: "w-20" },
  { header: "Name", cellWidth: "w-32" },
  { header: "Email", cellWidth: "w-40" },
  { header: "Conversations", width: "w-[100px]", cellWidth: "w-8", centered: true },
  { header: "Last Seen", width: "w-[140px]", cellWidth: "w-24" },
];

interface UsersTableProps {
  visitors: Visitor[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (visitor: Visitor) => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function truncateId(id: string, maxLength = 8): string {
  if (id.length <= maxLength) return id;
  return `${id.slice(0, maxLength)}...`;
}

export function UsersTable({
  visitors,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: UsersTableProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

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
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (isLoading) {
    return <TableSkeleton columns={USERS_TABLE_COLUMNS} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load users</p>
      </div>
    );
  }

  if (visitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Users className="h-8 w-8" />
        <p>No users found</p>
        <p className="text-sm">
          Users will appear here when they are identified via the SDK
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border h-full">
      <table className={cn("w-full caption-bottom text-xs md:text-sm")}>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-background hover:bg-background">
            <TableHead className="w-[120px] bg-background">Visitor ID</TableHead>
            <TableHead className="w-[140px] bg-background">User ID</TableHead>
            <TableHead className="bg-background">Name</TableHead>
            <TableHead className="bg-background">Email</TableHead>
            <TableHead className="w-[100px] bg-background text-center">Conversations</TableHead>
            <TableHead className="w-[140px] bg-background">Last Seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitors.map((visitor) => (
            <TableRow
              key={visitor.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(visitor)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">
                {truncateId(visitor.visitor_id)}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {visitor.external_user_id ? (
                  truncateId(visitor.external_user_id)
                ) : (
                  <span className="italic">-</span>
                )}
              </TableCell>
              <TableCell>
                {visitor.name || (
                  <span className="text-muted-foreground italic">
                    No name
                  </span>
                )}
              </TableCell>
              <TableCell>
                {visitor.email || (
                  <span className="text-muted-foreground italic">
                    No email
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {visitor.conversation_count}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(visitor.last_seen_at), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}
