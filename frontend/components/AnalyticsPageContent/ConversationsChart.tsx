"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConversationsTrendData } from "@/types/admin";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ConversationsChartProps {
  data: ConversationsTrendData[];
  isLoading?: boolean;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload?: ConversationsTrendData }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const originalDate = payload[0].payload?.date;

  if (!originalDate) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">
        {format(parseISO(originalDate), "MMM d, yyyy")}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">
        {payload[0].value.toLocaleString()} conversations
      </p>
    </div>
  );
}

function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <Card variant="default" className={cn("admin-card", className)}>
      <CardHeader>
        <div className="h-5 w-48 admin-shimmer rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full admin-shimmer rounded" />
      </CardContent>
    </Card>
  );
}

export function ConversationsChart({
  data,
  isLoading,
  className,
}: ConversationsChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      formattedDate: format(parseISO(item.date), "MMM d"),
    }));
  }, [data]);

  if (isLoading) {
    return <LoadingSkeleton className={className} />;
  }

  return (
    <Card variant="default" className={className}>
      <CardHeader>
        <CardTitle>Conversations Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="conversationsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                dx={-10}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#conversationsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
