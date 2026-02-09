"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AIUsageStats } from "@/types/admin";
import { ThumbsDown, ThumbsUp } from "lucide-react";

interface FeedbackSummaryProps {
  feedback: AIUsageStats["feedback"] | undefined;
  isLoading?: boolean;
}

function LoadingSkeleton() {
  return (
    <Card className="admin-card">
      <CardHeader>
        <div className="h-5 w-32 admin-shimmer rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-24 admin-shimmer rounded" />
        <div className="space-y-2">
          <div className="h-4 admin-shimmer rounded" />
          <div className="h-4 admin-shimmer rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function FeedbackSummary({ feedback, isLoading }: FeedbackSummaryProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const helpfulCount = feedback?.helpfulCount ?? 0;
  const unhelpfulCount = feedback?.unhelpfulCount ?? 0;
  const totalFeedback = helpfulCount + unhelpfulCount;
  const helpfulPercent =
    totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0;
  const unhelpfulPercent = totalFeedback > 0 ? 100 - helpfulPercent : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Progress Bar */}
        <div className="space-y-2">
          <div className="flex h-6 overflow-hidden rounded-full bg-muted">
            {helpfulPercent > 0 && (
              <div
                className="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-400 text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${helpfulPercent}%` }}
              >
                {helpfulPercent > 15 && `${helpfulPercent}%`}
              </div>
            )}
            {unhelpfulPercent > 0 && (
              <div
                className="flex items-center justify-center bg-gradient-to-r from-red-400 to-red-300 text-xs font-medium text-red-900 transition-all duration-500"
                style={{ width: `${unhelpfulPercent}%` }}
              >
                {unhelpfulPercent > 15 && `${unhelpfulPercent}%`}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-3 @[280px]:grid-cols-2 @[280px]:gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
              <ThumbsUp className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {helpfulCount}
                </p>
                <p className="text-xs text-muted-foreground">Helpful</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/10">
              <ThumbsDown className="h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {unhelpfulCount}
                </p>
                <p className="text-xs text-muted-foreground">Not Helpful</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total */}
        <p className="text-center text-xs text-muted-foreground">
          {totalFeedback} total responses
        </p>
      </CardContent>
    </Card>
  );
}
