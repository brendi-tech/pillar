'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

import { DateRangePicker } from '@/components/DateRangePicker';
import { PageHeader } from '@/components/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { getDefaultDateRange, getDateRangeFromPreset } from '@/lib/admin/analytics-api';
import { conversationsListQuery } from '@/queries/analytics.queries';
import type {
  AnalyticsDateRange,
  ConversationFilters,
  ConversationStatus,
  ChatConversationListItem,
  QueryType,
} from '@/types/admin';

import { ConversationsTable } from './ConversationsTable';
import { ConversationDetailDrawer } from './ConversationDetailDrawer';

export function ConversationsPageContent() {
  // Read initial values from URL parameters
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialRange = searchParams.get('range') as '7d' | '30d' | '90d' | null;

  // Date range state - use URL param if provided
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(() =>
    initialRange ? getDateRangeFromPreset(initialRange) : getDefaultDateRange()
  );

  // Drawer state
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter state
  const [status, setStatus] = useState<ConversationStatus | 'all'>('all');
  const [hasNegativeFeedback, setHasNegativeFeedback] = useState<boolean | undefined>(undefined);
  const [queryType, setQueryType] = useState<QueryType | 'all'>('all');
  const [intentCategory, setIntentCategory] = useState<string>('');
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build filters
  // For preset ranges (7d, 30d, 90d), don't include started_at_lte - we want "until now"
  // For custom ranges, include started_at_lte to bound the end date
  const filters: ConversationFilters = {
    started_at_gte: dateRange.start,
    started_at_lte: dateRange.preset === 'custom' ? dateRange.end : undefined,
    status: status !== 'all' ? status : undefined,
    has_negative_feedback: hasNegativeFeedback,
    query_type: queryType !== 'all' ? queryType : undefined,
    intent_category: intentCategory || undefined,
    search: search || undefined,
    page,
    page_size: pageSize,
  };

  // Query conversations
  const { data, isPending, isError, refetch } = useQuery(
    conversationsListQuery(filters)
  );

  const conversations = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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
    <div className="space-y-6 p-page">
      {/* Header */}
      <PageHeader
        title="Conversations"
        description="Review AI chat conversations and create corrections"
        actions={<DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as ConversationStatus | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Negative Feedback Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Feedback:</span>
          <Select
            value={
              hasNegativeFeedback === undefined
                ? 'all'
                : hasNegativeFeedback
                ? 'negative'
                : 'positive'
            }
            onValueChange={(value) => {
              setHasNegativeFeedback(
                value === 'all' ? undefined : value === 'negative'
              );
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All feedback" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="negative">Has Negative</SelectItem>
              <SelectItem value="positive">No Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Query Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          <Select
            value={queryType}
            onValueChange={(value) => {
              setQueryType(value as QueryType | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ask">Ask</SelectItem>
              <SelectItem value="search">Search</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Intent Category Filter */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Intent category..."
            value={intentCategory}
            onChange={(e) => {
              setIntentCategory(e.target.value);
              setPage(1);
            }}
            className="w-[160px]"
          />
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search in messages..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span>
            {totalCount.toLocaleString()} conversation{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
        {hasNegativeFeedback && (
          <span className="text-orange-600 dark:text-orange-400">
            Showing only conversations with negative feedback
          </span>
        )}
      </div>

      {/* Table */}
      <ConversationsTable
        conversations={conversations}
        isLoading={isPending}
        isError={isError}
        onRowClick={handleRowClick}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

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
