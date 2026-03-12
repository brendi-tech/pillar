"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Visitor } from "@/lib/admin/visitors-api";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, MessageSquare, Users } from "lucide-react";
import { useEffect, useRef } from "react";

export interface UserCardListProps {
  visitors: Visitor[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (visitor: Visitor) => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function UserCard({
  visitor,
  onClick,
}: {
  visitor: Visitor;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">
            {visitor.name || (
              <span className="italic text-muted-foreground">No name</span>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {visitor.email || <span className="italic">No email</span>}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {visitor.conversation_count} conversations
        </span>
        <span>
          {formatDistanceToNow(new Date(visitor.last_seen_at), {
            addSuffix: true,
          })}
        </span>
      </div>
    </button>
  );
}

function UserCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function UserCardList({
  visitors,
  isLoading,
  isError,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: UserCardListProps) {
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
          <UserCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
        Failed to load users
      </div>
    );
  }

  if (visitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No users found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Users will appear here when they are identified via the SDK
        </p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-12rem)]">
      <div className="space-y-3 p-1">
        {visitors.map((visitor) => (
          <UserCard
            key={visitor.id}
            visitor={visitor}
            onClick={() => onRowClick(visitor)}
          />
        ))}
        {hasNextPage && (
          <div ref={loadMoreRef} className="py-2">
            {isFetchingNextPage && <UserCardSkeleton />}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
