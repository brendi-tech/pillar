"use client";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/DataTable";
import type { Visitor } from "@/lib/admin/visitors-api";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Users } from "lucide-react";
import { UserCardList } from "./UserCardList";

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

const columns: DataTableColumn<Visitor>[] = [
  {
    id: "visitor-id",
    header: "Visitor ID",
    width: "w-[120px]",
    skeletonWidth: "w-20",
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {truncateId(row.visitor_id)}
      </span>
    ),
  },
  {
    id: "user-id",
    header: "User ID",
    width: "w-[140px]",
    skeletonWidth: "w-20",
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.external_user_id ? (
          truncateId(row.external_user_id)
        ) : (
          <span className="italic">-</span>
        )}
      </span>
    ),
  },
  {
    id: "name",
    header: "Name",
    skeletonWidth: "w-32",
    cell: (row) =>
      row.name || (
        <span className="text-muted-foreground italic">No name</span>
      ),
  },
  {
    id: "email",
    header: "Email",
    skeletonWidth: "w-40",
    cell: (row) =>
      row.email || (
        <span className="text-muted-foreground italic">No email</span>
      ),
  },
  {
    id: "conversations",
    header: "Conversations",
    width: "w-[100px]",
    centered: true,
    skeletonWidth: "w-8",
    cell: (row) => (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        {row.conversation_count}
      </span>
    ),
  },
  {
    id: "last-seen",
    header: "Last Seen",
    width: "w-[140px]",
    skeletonWidth: "w-24",
    cell: (row) => (
      <span className="text-muted-foreground">
        {formatDistanceToNow(new Date(row.last_seen_at), {
          addSuffix: true,
        })}
      </span>
    ),
  },
];

export function UsersTable({
  visitors,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: UsersTableProps) {
  return (
    <>
      {/* Mobile: Card list */}
      <div className="md:hidden">
        <UserCardList
          visitors={visitors}
          isLoading={isLoading}
          isError={isError}
          onRowClick={onRowClick}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      </div>

      {/* Desktop: Data table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={visitors}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          isError={isError}
          onRowClick={onRowClick}
          errorMessage="Failed to load users"
          emptyState={{
            icon: <Users className="h-8 w-8" />,
            title: "No users found",
            description:
              "Users will appear here when they are identified via the SDK",
          }}
          infiniteScroll={{
            hasNextPage,
            isFetchingNextPage,
            onLoadMore,
          }}
        />
      </div>
    </>
  );
}
