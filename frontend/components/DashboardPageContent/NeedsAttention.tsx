"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NeedsAttentionItem } from "@/types/admin";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  ThumbsDown,
} from "lucide-react";
import Link from "next/link";

interface NeedsAttentionProps {
  items: NeedsAttentionItem[];
}

const iconMap = {
  stale: AlertTriangle,
  pending_review: Clock,
  low_performing: ThumbsDown,
};

const colorMap = {
  stale: {
    bg: "bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/50",
    hover: "hover:border-amber-300 dark:hover:border-amber-700",
  },
  pending_review: {
    bg: "bg-gradient-to-br from-sky-100 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/20",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-800/50",
    hover: "hover:border-sky-300 dark:hover:border-sky-700",
  },
  low_performing: {
    bg: "bg-gradient-to-br from-rose-100 to-red-50 dark:from-rose-900/30 dark:to-red-900/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/50",
    hover: "hover:border-rose-300 dark:hover:border-rose-700",
  },
};

export function NeedsAttention({ items }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <Card className="admin-card">
        <CardHeader>
          <CardTitle>Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-100 to-green-50 p-4 shadow-md shadow-emerald-500/10 dark:from-emerald-900/40 dark:to-green-900/20">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="mt-4 font-medium text-[var(--hc-text)]">
              All caught up!
            </p>
            <p className="text-sm text-[var(--hc-text-muted)]">
              No items need your attention right now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="admin-card">
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => {
          const Icon = iconMap[item.type];
          const colors = colorMap[item.type];

          return (
            <Link
              key={index}
              href={item.link}
              className={cn(
                "group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 admin-press",
                colors.border,
                colors.hover,
                "bg-[var(--admin-surface-elevated)] hover:shadow-sm"
              )}
            >
              <div className={cn("rounded-xl p-2.5", colors.bg)}>
                <Icon className={cn("h-4 w-4", colors.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--hc-text)]">
                  {item.count}{" "}
                  {item.type === "stale"
                    ? "stale articles"
                    : item.type === "pending_review"
                      ? "pending review"
                      : "low-performing articles"}
                </p>
                <p className="text-xs text-[var(--hc-text-muted)] truncate">
                  {item.message}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--hc-text-muted)] transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
