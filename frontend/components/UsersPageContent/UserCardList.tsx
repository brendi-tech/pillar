"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedUser } from "@/lib/admin/visitors-api";
import { CHANNEL_BADGE_STYLES } from "@/types/agent";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Users } from "lucide-react";
import { useEffect, useRef } from "react";

export interface UserCardListProps {
  users: UnifiedUser[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (user: UnifiedUser) => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function UserCard({
  user,
  onClick,
}: {
  user: UnifiedUser;
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
            {user.name || (
              <span className="italic text-muted-foreground">No name</span>
            )}
          </p>
          <p className="truncate text-sm font-mono text-muted-foreground">
            {user.external_user_id}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {user.channels.map((ch) => (
          <Badge
            key={ch}
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 font-medium capitalize ${CHANNEL_BADGE_STYLES[ch] ?? ""}`}
          >
            {ch}
          </Badge>
        ))}
        {user.first_seen_at && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(user.first_seen_at), {
              addSuffix: true,
            })}
          </span>
        )}
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
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  );
}

export function UserCardList({
  users,
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

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No users found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Users will appear here when they interact via the SDK or linked
          channels
        </p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-12rem)]">
      <div className="space-y-3 p-1">
        {users.map((user) => (
          <UserCard
            key={user.external_user_id}
            user={user}
            onClick={() => onRowClick(user)}
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
