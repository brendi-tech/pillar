"use client";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageSquare, ThumbsDown } from "lucide-react";
import type {
  ChatConversationListItem,
  ConversationStatus,
} from "@/types/admin";

interface ConversationsTableProps {
  conversations: ChatConversationListItem[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (conversation: ChatConversationListItem) => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function getStatusBadgeVariant(
  status: ConversationStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "resolved":
      return "default";
    case "escalated":
      return "destructive";
    case "active":
      return "secondary";
    case "abandoned":
      return "outline";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: ConversationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const columns: DataTableColumn<ChatConversationListItem>[] = [
  {
    id: "started",
    header: "Started",
    width: "w-[140px]",
    skeletonWidth: "w-24",
    cell: (row) => (
      <span className="text-muted-foreground">
        {format(new Date(row.started_at), "MMM d, h:mm a")}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "w-[100px]",
    skeletonWidth: "w-16",
    cell: (row) => (
      <Badge variant={getStatusBadgeVariant(row.status)}>
        {getStatusLabel(row.status)}
      </Badge>
    ),
  },
  {
    id: "messages",
    header: "Messages",
    width: "w-[80px]",
    centered: true,
    skeletonWidth: "w-8",
    cell: (row) => (
      <span className="text-muted-foreground">{row.message_count}</span>
    ),
  },
  {
    id: "first-question",
    header: "First Question",
    skeletonWidth: "w-64",
    cell: (row) => (
      <p className="truncate max-w-400">
        {row.first_user_message || (
          <span className="text-muted-foreground italic">No message</span>
        )}
      </p>
    ),
  },
  {
    id: "feedback",
    header: "Feedback",
    width: "w-[72px]",
    centered: true,
    skeletonWidth: "w-6",
    headerClassName: "pr-4",
    cell: (row) =>
      row.has_negative_feedback ? (
        <ThumbsDown className="mx-auto h-4 w-4 text-orange-500" />
      ) : null,
  },
];

export function ConversationsTable({
  conversations,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ConversationsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={conversations}
      keyExtractor={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      onRowClick={onRowClick}
      errorMessage="Failed to load conversations"
      emptyState={{
        icon: <MessageSquare className="h-8 w-8" />,
        title: "No conversations found",
        description: "Try adjusting your filters or date range",
      }}
      infiniteScroll={{
        hasNextPage,
        isFetchingNextPage,
        onLoadMore,
      }}
    />
  );
}
