"use client";

import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { AlertCircle, MessageSquare, ThumbsDown } from "lucide-react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
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

export function ConversationsTable({
  conversations,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ConversationsTableProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
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
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load conversations</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <MessageSquare className="h-8 w-8" />
        <p>No conversations found</p>
        <p className="text-sm">Try adjusting your filters or date range</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border h-full">
      <table className={cn("w-full caption-bottom text-xs md:text-sm")}>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-background hover:bg-background">
            <TableHead className="w-[140px] bg-background">Started</TableHead>
            <TableHead className="w-[100px] bg-background">Status</TableHead>
            <TableHead className="w-[80px] bg-background text-center">
              Messages
            </TableHead>
            <TableHead className="bg-background">First Question</TableHead>
            <TableHead className="w-[72px] bg-background text-center pr-4">
              Feedback
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conversation) => (
            <TableRow
              key={conversation.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(conversation)}
            >
              <TableCell className="text-muted-foreground">
                {format(new Date(conversation.started_at), "MMM d, h:mm a")}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(conversation.status)}>
                  {getStatusLabel(conversation.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {conversation.message_count}
              </TableCell>
              <TableCell className="max-w-[400px]">
                <p className="truncate">
                  {conversation.first_user_message || (
                    <span className="text-muted-foreground italic">
                      No message
                    </span>
                  )}
                </p>
              </TableCell>
              <TableCell className="text-center">
                {conversation.has_negative_feedback && (
                  <ThumbsDown className="mx-auto h-4 w-4 text-orange-500" />
                )}
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
