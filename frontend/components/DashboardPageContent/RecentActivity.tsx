"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/types/admin";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, FileText, Plus, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";

interface RecentActivityProps {
  items: ActivityItem[];
}

const iconMap = {
  article_edited: FileText,
  article_published: Upload,
  source_synced: RefreshCw,
  article_created: Plus,
};

const colorMap = {
  article_edited: {
    bg: "bg-gradient-to-br from-sky-100 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/20",
    text: "text-sky-600 dark:text-sky-400",
  },
  article_published: {
    bg: "bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  source_synced: {
    bg: "bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  article_created: {
    bg: "bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20",
    text: "text-amber-600 dark:text-amber-400",
  },
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="admin-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Link
          href="/knowledge"
          className="group flex items-center gap-1 text-sm font-medium text-[#C2410C] transition-colors hover:text-[#E85D04] dark:text-orange-400 dark:hover:text-orange-300"
        >
          View all
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[var(--hc-text-muted)]">
              No recent activity
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-[var(--admin-border)] via-[var(--admin-border)] to-transparent" />

            {items.map((item, index) => {
              const Icon = iconMap[item.type];
              const colors = colorMap[item.type];

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex items-start gap-3 py-3 transition-all duration-200",
                    index === 0 && "pt-0"
                  )}
                >
                  <div
                    className={cn(
                      "relative z-10 rounded-xl p-2 shadow-sm",
                      colors.bg
                    )}
                  >
                    <Icon className={cn("h-4 w-4", colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-[var(--hc-text)]">
                      {item.title}
                    </p>
                    <p className="text-xs text-[var(--hc-text-muted)] truncate">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--hc-text-muted)] whitespace-nowrap pt-0.5">
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
