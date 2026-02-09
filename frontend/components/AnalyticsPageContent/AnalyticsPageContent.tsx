"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { getDefaultDateRange, getDateRangeFromPreset } from "@/lib/admin/analytics-api";
import {
  aiUsageQuery,
  conversationsTrendQuery,
} from "@/queries/analytics.queries";
import type { AnalyticsDateRange } from "@/types/admin";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";

import { PageHeader } from "@/components/shared";
import { AIMetricsOverview } from "./AIMetricsOverview";
import { FeedbackSummary } from "./FeedbackSummary";
import { TopQuestions } from "./TopQuestions";

// Lazy-load recharts-based component to reduce initial bundle size
const ConversationsChart = dynamic(
  () => import("./ConversationsChart").then((mod) => ({ default: mod.ConversationsChart })),
  { ssr: false }
);

export function AnalyticsPageContent() {
  // Read initial range from URL parameters
  const searchParams = useSearchParams();
  const initialRange = searchParams.get('range') as '7d' | '30d' | '90d' | null;

  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(() =>
    initialRange ? getDateRangeFromPreset(initialRange) : getDefaultDateRange()
  );

  // Primary queries - AI metrics
  const { data: aiUsageData, isPending: isAiUsageLoading } = useQuery(
    aiUsageQuery(dateRange)
  );
  const { data: conversationsTrendData, isPending: isTrendLoading } = useQuery(
    conversationsTrendQuery(dateRange)
  );

  // Derived data
  const aiUsageStats = aiUsageData?.stats ?? null;
  const conversationsTrend = conversationsTrendData?.data ?? [];

  return (
    <div className="space-y-6 p-page">
      {/* Header */}
      <PageHeader
        title="Insights"
        description="Understand how your product copilot is performing"
        actions={<DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {/* 1. Hero: AI Metrics (North Star) */}
      <AIMetricsOverview stats={aiUsageStats} isLoading={isAiUsageLoading} />

      {/* 2. Charts Row: Trend + Feedback */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ConversationsChart
          data={conversationsTrend}
          isLoading={isTrendLoading}
          className="lg:col-span-2"
        />
        <FeedbackSummary
          feedback={aiUsageStats?.feedback}
          isLoading={isAiUsageLoading}
        />
      </div>

      {/* 3. Top Questions */}
      <TopQuestions
        questions={aiUsageStats?.topQuestions ?? []}
        isLoading={isAiUsageLoading}
      />
    </div>
  );
}
