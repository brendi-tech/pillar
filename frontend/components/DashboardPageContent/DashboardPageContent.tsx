"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { articlesAPI } from "@/lib/admin/articles.api";
import { useAuth } from "@/providers/AuthProvider";
import type {
  ActivityItem,
  AISuggestion,
  DashboardStats,
  NeedsAttentionItem,
} from "@/types/admin";
import { Link2, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NeedsAttention } from "./NeedsAttention";
import { RecentActivity } from "./RecentActivity";
import { StatsCards } from "./StatsCards";
import { WelcomeBanner } from "./WelcomeBanner";

// Default empty states
const EMPTY_STATS: DashboardStats = {
  articles: {
    total: 0,
    published: 0,
    drafts: 0,
    review: 0,
    change_this_week: 0,
  },
  views: {
    total_30d: 0,
    change_percentage: 0,
  },
  searches: {
    total_30d: 0,
    resolved_percentage: 0,
  },
  helpfulness: {
    percentage: 0,
    change_percentage: 0,
  },
};

export function DashboardPageContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [hasContent, setHasContent] = useState<boolean | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch real data from APIs
        const articlesResponse = await articlesAPI.list({
          page: 1,
          page_size: 1,
        });

        const articleCount = articlesResponse.count;
        setHasContent(articleCount > 0);

        if (articleCount === 0) {
          // No content - show empty dashboard state
          setStats(EMPTY_STATS);
          setNeedsAttention([]);
          setRecentActivity([]);
          setSuggestions([]);
        } else {
          // TODO: Fetch real analytics data when analytics API is ready
          // For now, show placeholder stats based on article count
          setStats({
            articles: {
              total: articleCount,
              published: articleCount,
              drafts: 0,
              review: 0,
              change_this_week: 0,
            },
            views: {
              total_30d: 0,
              change_percentage: 0,
            },
            searches: {
              total_30d: 0,
              resolved_percentage: 0,
            },
            helpfulness: {
              percentage: 0,
              change_percentage: 0,
            },
          });
          setNeedsAttention([]);
          setRecentActivity([]);
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // On error, show empty state
        setHasContent(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const userName = user?.name?.split(" ")[0] || "there";

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8 p-page">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-9 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-5 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state for new users with no content
  if (hasContent === false) {
    return (
      <div className="space-y-8 p-page">
        {/* Page Header */}
        <div className="flex items-center justify-between admin-animate-in">
          <div>
            <h1
              className="text-3xl tracking-tight text-[var(--hc-text)] admin-heading"
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
              }}
            >
              Welcome, {userName}!
            </h1>
            <p className="mt-1 text-[var(--hc-text-muted)]">
              Let&apos;s get your product copilot set up.
            </p>
          </div>
        </div>

        {/* Getting Started Card */}
        <Card className="admin-card border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 p-4">
              <Sparkles className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-[var(--hc-text)]">
              Your product copilot is ready
            </h3>

            <p className="mt-2 max-w-md text-sm text-[var(--hc-text-muted)]">
              Start by connecting a content source or creating your first
              article. Our AI agents will help you organize and optimize your
              content.
            </p>

            <div className="mt-6">
              <Button asChild className="admin-btn-primary">
                <Link href="/knowledge/new" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Connect a Source
                </Link>
              </Button>
            </div>

            {/* Feature highlights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left">
                <div className="text-sm font-medium text-[var(--hc-text)]">
                  Import Content
                </div>
                <p className="mt-1 text-xs text-[var(--hc-text-muted)]">
                  Connect Zendesk, Notion, or your docs site
                </p>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left">
                <div className="text-sm font-medium text-[var(--hc-text)]">
                  AI Enhancement
                </div>
                <p className="mt-1 text-xs text-[var(--hc-text-muted)]">
                  Auto-capture screenshots and optimize articles
                </p>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left">
                <div className="text-sm font-medium text-[var(--hc-text)]">
                  Analytics
                </div>
                <p className="mt-1 text-xs text-[var(--hc-text-muted)]">
                  Track views, helpfulness, and content gaps
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-page">
      {/* Page Header */}
      <div className="flex items-center justify-between admin-animate-in">
        <div>
          <h1
            className="text-3xl tracking-tight text-[var(--hc-text)] admin-heading"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
            }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-[var(--hc-text-muted)]">
            Welcome back, {userName}! Here&apos;s what&apos;s happening with
            your product copilot.
          </p>
        </div>
        <Button
          asChild
          className="admin-btn-primary rounded-xl px-5 py-2.5 admin-press"
        >
          <Link href="/knowledge/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Link>
        </Button>
      </div>

      {/* Welcome Banner (for new users) - only show if they have very few articles */}
      {stats.articles.total < 5 && (
        <div className="admin-animate-in admin-delay-1">
          <WelcomeBanner userName={userName} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="admin-animate-in admin-delay-2">
        <StatsCards stats={stats} />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Needs Attention */}
        <div className="admin-animate-in admin-delay-3">
          <NeedsAttention items={needsAttention} />
        </div>

        {/* Recent Activity */}
        <div className="admin-animate-in admin-delay-4">
          <RecentActivity items={recentActivity} />
        </div>
      </div>

      {/* AI Suggestions - only show if there are suggestions */}
      {suggestions.length > 0 && (
        <div className="admin-animate-in admin-delay-5">
          {/* AI Suggestions content would go here */}
        </div>
      )}
    </div>
  );
}
