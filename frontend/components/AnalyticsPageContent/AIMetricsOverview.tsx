"use client";

import { cn } from "@/lib/utils";
import type { AIUsageStats } from "@/types/admin";
import {
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface AIMetricsOverviewProps {
  stats: AIUsageStats | null;
  isLoading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  changePercent?: number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: "emerald" | "amber" | "violet" | "orange";
  isLoading?: boolean;
  invertTrend?: boolean; // For metrics where down is good (like escalations)
}

const accentStyles = {
  emerald: {
    iconBg:
      "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    iconBg:
      "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    iconBg:
      "bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/10",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  orange: {
    iconBg:
      "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
};

function StatCard({
  title,
  value,
  changePercent,
  subtitle,
  icon: Icon,
  accentColor,
  isLoading,
  invertTrend = false,
}: StatCardProps) {
  const accent = accentStyles[accentColor];
  // For inverted trends (like escalations), down is positive
  const isPositive = invertTrend
    ? (changePercent ?? 0) <= 0
    : (changePercent ?? 0) >= 0;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-3 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2 sm:space-y-3">
            <div className="h-3 w-20 sm:h-4 sm:w-24 animate-pulse rounded bg-muted" />
            <div className="h-6 w-16 sm:h-8 sm:w-20 animate-pulse rounded bg-muted" />
            <div className="hidden sm:block h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-8 sm:h-11 sm:w-11 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-5 transition-all duration-200 hover:bg-accent/50 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-wide truncate">
            {title}
          </p>
          <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <div className="mt-1 sm:mt-2 flex items-center gap-1.5">
            {changePercent !== undefined ? (
              <>
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
                    isPositive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {changePercent >= 0 ? "+" : ""}
                  {changePercent}%
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  vs last period
                </span>
              </>
            ) : subtitle ? (
              <span className="hidden sm:inline text-xs text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
        <div className={cn("rounded-xl p-2 sm:p-3 shadow-sm shrink-0", accent.iconBg)}>
          <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", accent.iconColor)} />
        </div>
      </div>
    </div>
  );
}

export function AIMetricsOverview({ stats, isLoading }: AIMetricsOverviewProps) {
  // Default values for when stats is null
  const resolutionRate = stats?.resolutionRate ?? 0;
  const totalConversations = stats?.totalConversations ?? 0;
  const changePercent = stats?.changePercent ?? 0;
  const helpfulRate = stats?.feedback?.helpfulRate ?? 0;
  const escalatedCount = stats?.escalatedCount ?? 0;

  return (
    <div className="@container grid grid-cols-2 gap-3 sm:gap-4 @[720px]:grid-cols-4">
      <StatCard
        title="Resolution Rate"
        value={`${resolutionRate}%`}
        subtitle="self-service success"
        icon={CheckCircle}
        accentColor="emerald"
        isLoading={isLoading}
      />
      <StatCard
        title="Conversations"
        value={totalConversations}
        changePercent={changePercent}
        icon={MessageSquare}
        accentColor="amber"
        isLoading={isLoading}
      />
      <StatCard
        title="Helpfulness"
        value={`${helpfulRate}%`}
        subtitle="positive feedback"
        icon={ThumbsUp}
        accentColor="violet"
        isLoading={isLoading}
      />
      <StatCard
        title="Escalated"
        value={escalatedCount}
        subtitle="needed human help"
        icon={AlertTriangle}
        accentColor="orange"
        isLoading={isLoading}
      />
    </div>
  );
}
