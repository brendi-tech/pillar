"use client";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import type { UnifiedUser } from "@/lib/admin/visitors-api";
import { CHANNEL_BADGE_STYLES } from "@/types/agent";
import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";
import { UserCardList } from "./UserCardList";

interface UsersTableProps {
  users: UnifiedUser[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (user: UnifiedUser) => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function ChannelBadges({ channels }: { channels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((ch) => (
        <Badge
          key={ch}
          variant="secondary"
          className={`text-[10px] px-1.5 py-0 font-medium capitalize ${CHANNEL_BADGE_STYLES[ch] ?? ""}`}
        >
          {ch}
        </Badge>
      ))}
    </div>
  );
}

const columns: DataTableColumn<UnifiedUser>[] = [
  {
    id: "user-id",
    header: "User ID",
    width: "w-[180px]",
    skeletonWidth: "w-24",
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground truncate block max-w-[160px]" title={row.external_user_id}>
        {row.external_user_id}
      </span>
    ),
  },
  {
    id: "name",
    header: "Name",
    skeletonWidth: "w-32",
    cell: (row) =>
      row.name || (
        <span className="text-muted-foreground italic">-</span>
      ),
  },
  {
    id: "channels",
    header: "Channels",
    width: "w-[200px]",
    skeletonWidth: "w-28",
    cell: (row) => <ChannelBadges channels={row.channels} />,
  },
  {
    id: "first-seen",
    header: "First Seen",
    width: "w-[140px]",
    skeletonWidth: "w-24",
    cell: (row) =>
      row.first_seen_at ? (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(row.first_seen_at), {
            addSuffix: true,
          })}
        </span>
      ) : (
        <span className="text-muted-foreground italic">-</span>
      ),
  },
  {
    id: "last-active",
    header: "Last Active",
    width: "w-[140px]",
    skeletonWidth: "w-24",
    cell: (row) =>
      row.last_seen_at ? (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(row.last_seen_at), {
            addSuffix: true,
          })}
        </span>
      ) : (
        <span className="text-muted-foreground italic">-</span>
      ),
  },
];

export function UsersTable({
  users,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: UsersTableProps) {
  return (
    <>
      <div className="md:hidden">
        <UserCardList
          users={users}
          isLoading={isLoading}
          isError={isError}
          onRowClick={onRowClick}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(row) => row.external_user_id}
          isLoading={isLoading}
          isError={isError}
          onRowClick={onRowClick}
          errorMessage="Failed to load users"
          emptyState={{
            icon: <Users className="h-8 w-8" />,
            title: "No users found",
            description:
              "Users will appear here when they interact via the SDK or linked channels",
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
