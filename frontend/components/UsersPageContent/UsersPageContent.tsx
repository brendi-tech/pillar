"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UnifiedUser } from "@/lib/admin/visitors-api";
import { unifiedUsersInfiniteQuery } from "@/queries/visitors.queries";

import { PageHeader } from "../shared";
import { UserDetailModal } from "../UserDetailModal";
import { UsersTable } from "./UsersTable";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function UsersPageContent() {
  const [selectedUser, setSelectedUser] = useState<UnifiedUser | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const {
    data,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    unifiedUsersInfiniteQuery({
      page_size: 20,
      search: debouncedSearch || undefined,
    })
  );

  const users = data?.pages.flatMap((page) => page.results) ?? [];

  const handleRowClick = (user: UnifiedUser) => {
    setSelectedUser(user);
  };

  const handleModalClose = () => {
    setSelectedUser(null);
  };

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="p-page flex h-full max-w-page mx-auto overflow-hidden flex-col gap-6 max-md:gap-4">
      <PageHeader
        title="Users"
        description="All identified users across web, Discord, Slack, and other channels"
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by ID, name, or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <UsersTable
          users={users}
          isLoading={isPending}
          isError={isError}
          onRowClick={handleRowClick}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={handleLoadMore}
        />
      </div>

      <UserDetailModal
        user={selectedUser}
        open={selectedUser !== null}
        onOpenChange={(open: boolean) => {
          if (!open) handleModalClose();
        }}
      />
    </div>
  );
}
