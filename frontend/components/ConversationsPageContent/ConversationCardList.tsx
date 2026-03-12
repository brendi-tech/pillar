"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChatConversationListItem,
  ConversationStatus,
} from "@/types/admin";
import { format } from "date-fns";
import { ChevronRight, MessageSquare, ThumbsDown } from "lucide-react";
import { useEffect, useRef } from "react";

export interface ConversationCardListProps {
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

function ConversationCard({
  conversation,
  onClick,
}: {
  conversation: ChatConversationListItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm">
            {conversation.first_user_message || (
              <span className="italic text-muted-foreground">No message</span>
            )}
          </p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge
          variant={getStatusBadgeVariant(conversation.status)}
          className="text-xs"
        >
          {getStatusLabel(conversation.status)}
        </Badge>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {conversation.message_count}
        </span>
        <span>
          {format(new Date(conversation.started_at), "MMM d, h:mm a")}
        </span>
        {conversation.has_negative_feedback && (
          <ThumbsDown className="h-3 w-3 text-orange-500" />
        )}
      </div>
    </button>
  );
}

function ConversationCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ConversationCardList({
  conversations,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ConversationCardListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: scrollContainer,
        threshold: 0.1,
      }
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <ConversationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
        Failed to load conversations
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No conversations found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or date range
        </p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-16rem)]">
      <div className="space-y-3 p-1">
        {conversations.map((conversation) => (
          <ConversationCard
            key={conversation.id}
            conversation={conversation}
            onClick={() => onRowClick(conversation)}
          />
        ))}
        {hasNextPage && (
          <div ref={loadMoreRef} className="py-2">
            {isFetchingNextPage && <ConversationCardSkeleton />}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
