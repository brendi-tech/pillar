"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DateRangePicker } from "@/components/DateRangePicker";
import { PageHeader } from "@/components/shared";
import {
  getDateRangeFromPreset,
  getDefaultDateRange,
} from "@/lib/admin/analytics-api";
import { conversationsListInfiniteQuery } from "@/queries/analytics.queries";
import type {
  AnalyticsDateRange,
  ChatConversationListItem,
  ConversationFilters,
} from "@/types/admin";

import { ConversationDetailDrawer } from "./ConversationDetailDrawer";
import {
  ConversationsFilters,
  type ConversationsFiltersState,
} from "./ConversationsFilters";
import { ConversationsTable } from "./ConversationsTable";

export function ConversationsPageContent() {
  // Read initial values from URL parameters
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialRange = searchParams.get("range") as "7d" | "30d" | "90d" | null;

  // Date range state - use URL param if provided
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(() =>
    initialRange ? getDateRangeFromPreset(initialRange) : getDefaultDateRange()
  );

  // Drawer state
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ConversationsFiltersState>({
    status: "all",
    hasNegativeFeedback: undefined,
    queryType: "all",
    intentCategory: "",
    search: initialSearch,
  });
  const pageSize = 20;

  // Build query filters (without page - handled by infinite query)
  // For preset ranges (7d, 30d, 90d), don't include started_at_lte - we want "until now"
  // For custom ranges, include started_at_lte to bound the end date
  const queryFilters: Omit<ConversationFilters, "page"> = {
    started_at_gte: dateRange.start,
    started_at_lte: dateRange.preset === "custom" ? dateRange.end : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    has_negative_feedback: filters.hasNegativeFeedback,
    query_type: filters.queryType !== "all" ? filters.queryType : undefined,
    intent_category: filters.intentCategory || undefined,
    search: filters.search || undefined,
    page_size: pageSize,
  };

  // Query conversations with infinite pagination
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(conversationsListInfiniteQuery(queryFilters));

  // Flatten all pages into a single array
  const conversations = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data]
  );
  const totalCount = data?.pages[0]?.count ?? 0;

  // Handle row click - open drawer
  const handleRowClick = (conversation: ChatConversationListItem) => {
    setSelectedConversation(conversation.id);
    setIsDrawerOpen(true);
  };

  // Handle drawer close
  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedConversation(null);
  };

  // Handle correction created - refetch the list
  const handleCorrectionCreated = () => {
    refetch();
  };

  return (
    <div className="p-page flex h-full overflow-hidden flex-col gap-6 max-md:gap-4">
      {/* Header */}
      <PageHeader
        title="Conversations"
        description="Review AI chat conversations and create corrections"
        actions={
          <DateRangePicker
            className="max-md:hidden"
            value={dateRange}
            onChange={setDateRange}
          />
        }
      />

      {/* Filters */}
      <ConversationsFilters
        filters={filters}
        onFiltersChange={setFilters}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span>
            {totalCount.toLocaleString()} conversation
            {totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        {filters.hasNegativeFeedback && (
          <span className="text-orange-600 dark:text-orange-400">
            Showing only conversations with negative feedback
          </span>
        )}
      </div>
      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <ConversationsTable
          conversations={conversations}
          isLoading={isPending}
          isError={isError}
          onRowClick={handleRowClick}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />
      </div>

      {/* Detail Drawer */}
      <ConversationDetailDrawer
        conversationId={selectedConversation}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) handleDrawerClose();
        }}
        onCorrectionCreated={handleCorrectionCreated}
      />
    </div>
  );
}
