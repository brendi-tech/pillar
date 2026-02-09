"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsAPI, getDefaultDateRange } from "@/lib/admin/analytics-api";
import { cn } from "@/lib/utils";
import type { AnalyticsDateRange, ArticlePerformance } from "@/types/admin";
import {
  ArrowLeft,
  ArrowUpDown,
  Clock,
  Eye,
  FileText,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SortField = "views" | "helpfulPercentage" | "avgTimeOnPage";
type SortDirection = "asc" | "desc";

export default function ArticlesAnalyticsPage() {
  const [dateRange, setDateRange] =
    useState<AnalyticsDateRange>(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  const [articles, setArticles] = useState<ArticlePerformance[]>([]);
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<"all" | "low">("all");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [topRes, lowRes] = await Promise.all([
          analyticsAPI.getTopArticles(dateRange, 20),
          analyticsAPI.getLowPerformers(dateRange, 10),
        ]);

        // Combine and deduplicate
        const allArticles = [...topRes.articles, ...lowRes.articles];
        const uniqueArticles = allArticles.filter(
          (article, index, self) =>
            index === self.findIndex((a) => a.id === article.id)
        );
        setArticles(uniqueArticles);
      } catch (error) {
        console.error("Failed to fetch article analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedArticles = [...articles]
    .filter((a) => filter === "all" || a.helpfulPercentage < 60)
    .sort((a, b) => {
      const modifier = sortDirection === "asc" ? 1 : -1;
      return (a[sortField] - b[sortField]) * modifier;
    });

  const lowPerformersCount = articles.filter(
    (a) => a.helpfulPercentage < 60
  ).length;

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
            <span>Article Performance</span>
          </div>
        }
        description="See how each article is performing"
        actions={<DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-[var(--hc-primary)]" : ""}
        >
          All Articles
          <Badge variant="secondary" className="ml-2">
            {articles.length}
          </Badge>
        </Button>
        <Button
          variant={filter === "low" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("low")}
          className={cn(
            filter === "low" ? "bg-amber-600 hover:bg-amber-700" : "",
            "gap-2"
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Low Performers
          {lowPerformersCount > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "ml-1",
                filter === "low"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {lowPerformersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Articles Table */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle>
            {filter === "all" ? "All Articles" : "Low Performing Articles"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="mb-2 flex items-center gap-4 border-b border-[var(--admin-border)] pb-2 text-xs font-medium text-[var(--hc-text-muted)]">
            <div className="flex-1">Article</div>
            <button
              onClick={() => handleSort("views")}
              className="flex w-24 items-center justify-end gap-1 hover:text-[var(--hc-text)]"
            >
              <Eye className="h-3 w-3" />
              Views
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleSort("helpfulPercentage")}
              className="flex w-24 items-center justify-end gap-1 hover:text-[var(--hc-text)]"
            >
              <ThumbsUp className="h-3 w-3" />
              Helpful
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleSort("avgTimeOnPage")}
              className="flex w-24 items-center justify-end gap-1 hover:text-[var(--hc-text)]"
            >
              <Clock className="h-3 w-3" />
              Avg Time
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <div className="w-32 text-right">Category</div>
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 flex-1 admin-shimmer rounded" />
                  <div className="h-4 w-24 admin-shimmer rounded" />
                  <div className="h-4 w-24 admin-shimmer rounded" />
                  <div className="h-4 w-24 admin-shimmer rounded" />
                  <div className="h-4 w-32 admin-shimmer rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {sortedArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/admin/content/${article.id}`}
                  className={cn(
                    "flex items-center gap-4 rounded-lg p-3 text-sm transition-colors hover:bg-[var(--hc-surface-hover)]",
                    article.helpfulPercentage < 60 &&
                      "bg-amber-50/50 dark:bg-amber-900/10"
                  )}
                >
                  {/* Article Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-[var(--hc-text-muted)]" />
                      <span className="truncate font-medium text-[var(--hc-text)]">
                        {article.title}
                      </span>
                    </div>
                  </div>

                  {/* Views */}
                  <div className="w-24 text-right text-[var(--hc-text-muted)]">
                    {article.views.toLocaleString()}
                  </div>

                  {/* Helpfulness */}
                  <div className="w-24 text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "gap-1 text-xs",
                        article.helpfulPercentage >= 80
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : article.helpfulPercentage >= 60
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {article.helpfulPercentage}%
                    </Badge>
                  </div>

                  {/* Avg Time */}
                  <div className="w-24 text-right text-[var(--hc-text-muted)]">
                    {Math.floor(article.avgTimeOnPage / 60)}:
                    {String(article.avgTimeOnPage % 60).padStart(2, "0")}
                  </div>

                  {/* Category */}
                  <div className="w-32 truncate text-right text-xs text-[var(--hc-text-muted)]">
                    {article.category}
                  </div>
                </Link>
              ))}

              {sortedArticles.length === 0 && (
                <div className="py-8 text-center text-sm text-[var(--hc-text-muted)]">
                  {filter === "low"
                    ? "No low-performing articles found"
                    : "No article data available for this period"}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
