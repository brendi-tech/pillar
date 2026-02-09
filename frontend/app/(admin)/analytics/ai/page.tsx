"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsAPI, getDefaultDateRange } from "@/lib/admin/analytics-api";
import type { AIUsageStats, AnalyticsDateRange } from "@/types/admin";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle,
  MessageSquare,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AIAnalyticsPage() {
  const [dateRange, setDateRange] =
    useState<AnalyticsDateRange>(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<AIUsageStats | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await analyticsAPI.getAIUsage(dateRange);
        setStats(res.stats);
      } catch (error) {
        console.error("Failed to fetch AI analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  const resolvedCount = stats
    ? Math.round(stats.totalConversations * (stats.resolutionRate / 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/analytics">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span>AI Assistant Analytics</span>
          </div>
        }
        description="Understand how the AI assistant is performing"
        actions={<DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 p-3 dark:from-amber-900/30 dark:to-amber-900/10">
              <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : stats?.totalConversations.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Total Conversations
              </p>
            </div>
          </div>
        </Card>

        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 p-3 dark:from-emerald-900/30 dark:to-emerald-900/10">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : `${stats?.resolutionRate}%`}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Resolution Rate
              </p>
            </div>
          </div>
        </Card>

        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 p-3 dark:from-violet-900/30 dark:to-violet-900/10">
              <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : stats?.avgMessagesPerChat.toFixed(1)}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Avg Messages/Chat
              </p>
            </div>
          </div>
        </Card>

        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 p-3 dark:from-orange-900/30 dark:to-orange-900/10">
              <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : stats?.escalatedCount}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">Escalated</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Resolution Breakdown */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle>Resolution Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 admin-shimmer rounded" />
          ) : stats ? (
            <div className="space-y-4">
              <div className="flex h-8 overflow-hidden rounded-full">
                <div
                  className="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-400 text-xs font-medium text-white transition-all duration-500"
                  style={{ width: `${stats.resolutionRate}%` }}
                >
                  {stats.resolutionRate}% Resolved
                </div>
                <div
                  className="flex items-center justify-center bg-gradient-to-r from-amber-400 to-amber-300 text-xs font-medium text-amber-900 transition-all duration-500"
                  style={{ width: `${100 - stats.resolutionRate}%` }}
                >
                  {100 - stats.resolutionRate}% Escalated
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-xl font-bold text-[var(--hc-text)]">
                      {resolvedCount}
                    </p>
                    <p className="text-sm text-[var(--hc-text-muted)]">
                      Resolved by AI
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
                  <XCircle className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-xl font-bold text-[var(--hc-text)]">
                      {stats.escalatedCount}
                    </p>
                    <p className="text-sm text-[var(--hc-text-muted)]">
                      Escalated to support
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Questions */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle>Top Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 admin-shimmer rounded-full" />
                    <div className="h-4 flex-1 admin-shimmer rounded" />
                    <div className="h-5 w-12 admin-shimmer rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {stats?.topQuestions.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--hc-surface-hover)]"
                  >
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--hc-surface)] text-xs font-medium text-[var(--hc-text-muted)]">
                      {i + 1}
                    </div>
                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-[var(--hc-text-muted)]" />
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--hc-text)]">
                      {q.question}
                    </span>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {q.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escalation Reasons */}
        <Card className="admin-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle>Escalation Reasons</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 flex-1 admin-shimmer rounded" />
                    <div className="h-5 w-12 admin-shimmer rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.escalationReasons.map((reason, i) => {
                  const percentage =
                    stats.escalatedCount > 0
                      ? Math.round((reason.count / stats.escalatedCount) * 100)
                      : 0;

                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--admin-border)] p-3"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--hc-text)]">
                          {reason.reason}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        >
                          {reason.count}
                        </Badge>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
