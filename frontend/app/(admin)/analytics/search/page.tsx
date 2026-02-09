"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsAPI, getDefaultDateRange } from "@/lib/admin/analytics-api";
import { cn } from "@/lib/utils";
import type {
  AnalyticsDateRange,
  SearchQuery,
} from "@/types/admin";
import {
  AlertCircle,
  ArrowLeft,
  MousePointerClick,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SearchAnalyticsPage() {
  const [dateRange, setDateRange] =
    useState<AnalyticsDateRange>(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQueries, setSearchQueries] = useState<SearchQuery[]>([]);
  const [stats, setStats] = useState({
    totalSearches: 0,
    withResults: 0,
    noResults: 0,
  });

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const searchRes = await analyticsAPI.getSearchQueries(dateRange, 1, 50);

        setSearchQueries(searchRes.queries);

        // Calculate stats
        const totalSearches = searchRes.queries.reduce(
          (sum, q) => sum + q.count,
          0
        );
        const withResults = searchRes.queries.filter(
          (q) => q.hasResults
        ).length;
        const noResults = searchRes.queries.filter((q) => !q.hasResults).length;
        setStats({ totalSearches, withResults, noResults });
      } catch (error) {
        console.error("Failed to fetch search analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

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
            <span>Search Analytics</span>
          </div>
        }
        description="Understand what users are searching for"
        actions={<DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 p-3 dark:from-violet-900/30 dark:to-violet-900/10">
              <Search className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : stats.totalSearches.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Total Searches
              </p>
            </div>
          </div>
        </Card>

        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 p-3 dark:from-emerald-900/30 dark:to-emerald-900/10">
              <MousePointerClick className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading
                  ? "..."
                  : `${Math.round((stats.withResults / searchQueries.length) * 100 || 0)}%`}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">
                Found Results
              </p>
            </div>
          </div>
        </Card>

        <Card className="admin-card admin-stat-gradient p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 p-3 dark:from-amber-900/30 dark:to-amber-900/10">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--hc-text)]">
                {isLoading ? "..." : stats.noResults}
              </p>
              <p className="text-xs text-[var(--hc-text-muted)]">No Results</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Queries Table */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle>All Searches</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="mb-2 flex items-center gap-4 border-b border-[var(--admin-border)] pb-2 text-xs font-medium text-[var(--hc-text-muted)]">
            <div className="flex-1">Query</div>
            <div className="w-20 text-right">Searches</div>
            <div className="w-20 text-right">Clicks</div>
            <div className="w-16 text-right">CTR</div>
            <div className="w-48">Top Result</div>
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 flex-1 admin-shimmer rounded" />
                  <div className="h-4 w-20 admin-shimmer rounded" />
                  <div className="h-4 w-20 admin-shimmer rounded" />
                  <div className="h-4 w-16 admin-shimmer rounded" />
                  <div className="h-4 w-48 admin-shimmer rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {searchQueries.map((query) => (
                <div
                  key={query.query}
                  className={cn(
                    "flex items-center gap-4 rounded-lg p-2 text-sm transition-colors hover:bg-[var(--hc-surface-hover)]",
                    !query.hasResults &&
                      "bg-amber-50/50 dark:bg-amber-900/10"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {!query.hasResults && (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                    )}
                    <span className="truncate text-[var(--hc-text)]">
                      &ldquo;{query.query}&rdquo;
                    </span>
                  </div>
                  <div className="w-20 text-right text-[var(--hc-text-muted)]">
                    {query.count}
                  </div>
                  <div className="w-20 text-right text-[var(--hc-text-muted)]">
                    {query.clicks}
                  </div>
                  <div className="w-16 text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        query.ctr >= 70
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : query.ctr >= 40
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {query.ctr}%
                    </Badge>
                  </div>
                  <div className="w-48 truncate text-xs text-[var(--hc-text-muted)]">
                    {query.topResult ? (
                      <Link
                        href={`/admin/content/${query.topResult.id}`}
                        className="hover:text-[var(--hc-primary)] hover:underline"
                      >
                        {query.topResult.title}
                      </Link>
                    ) : (
                      <span className="italic text-amber-600 dark:text-amber-400">
                        No results
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
