'use client';

import { FileText, Eye, Search, ThumbsUp, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardStats } from '@/types/admin';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  accentColor: 'orange' | 'emerald' | 'violet' | 'amber';
}

const accentStyles = {
  orange: {
    iconBg: 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10',
    iconColor: 'text-orange-600 dark:text-orange-400',
    glow: 'shadow-orange-500/10',
  },
  emerald: {
    iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/10',
  },
  violet: {
    iconBg: 'bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    glow: 'shadow-violet-500/10',
  },
  amber: {
    iconBg: 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/10',
  },
};

function StatCard({ title, value, subtitle, icon: Icon, trend, accentColor }: StatCardProps) {
  const accent = accentStyles[accentColor];
  
  return (
    <div className="admin-card admin-stat-gradient p-5 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--hc-text-muted)] tracking-wide">
            {title}
          </p>
          <p 
            className="mt-2 text-3xl font-semibold tracking-tight text-[var(--hc-text)]"
            style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {trend && (
              <>
                <span
                  className={cn(
                    'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                    trend.isPositive 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              </>
            )}
            <span className="text-xs text-[var(--hc-text-muted)]">
              {subtitle}
            </span>
          </div>
        </div>
        <div className={cn(
          'rounded-xl p-3 shadow-lg',
          accent.iconBg,
          accent.glow
        )}>
          <Icon className={cn('h-5 w-5', accent.iconColor)} />
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Articles"
        value={stats.articles.total}
        subtitle={`${stats.articles.change_this_week >= 0 ? '+' : ''}${stats.articles.change_this_week} this week`}
        icon={FileText}
        accentColor="orange"
      />
      <StatCard
        title="Views (30d)"
        value={stats.views.total_30d}
        subtitle="vs last period"
        icon={Eye}
        accentColor="emerald"
        trend={{
          value: stats.views.change_percentage,
          isPositive: stats.views.change_percentage >= 0,
        }}
      />
      <StatCard
        title="Searches"
        value={stats.searches.total_30d}
        subtitle={`${stats.searches.resolved_percentage}% resolved`}
        icon={Search}
        accentColor="violet"
      />
      <StatCard
        title="Helpful"
        value={`${stats.helpfulness.percentage}%`}
        subtitle="satisfaction rate"
        icon={ThumbsUp}
        accentColor="amber"
        trend={{
          value: stats.helpfulness.change_percentage,
          isPositive: stats.helpfulness.change_percentage >= 0,
        }}
      />
    </div>
  );
}


