"use client";

import { TimestampFooter } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { actionExecutionStatsQuery } from "@/queries/actions.queries";
import { IMPLEMENTATION_STATUS_LABELS } from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { ImplementationStatsCardProps } from "./ToolDetailPage.types";

const CHART_COLORS = {
  success: "#10b981",
  failure: "#ef4444",
};

export function ImplementationStatsCard({
  action,
  implStatus,
}: ImplementationStatsCardProps) {
  const { data: executionStats, isLoading: statsLoading } = useQuery(
    actionExecutionStatsQuery(action.id)
  );

  const successCount = executionStats?.success_count ?? 0;
  const failureCount = executionStats?.failure_count ?? 0;
  const totalConfirmations = successCount + failureCount;
  const avgDuration = executionStats?.avg_duration_ms ?? 0;

  const successRate = useMemo(() => {
    if (totalConfirmations === 0) return null;
    return Math.round((successCount / totalConfirmations) * 100);
  }, [successCount, totalConfirmations]);

  const chartData = useMemo(() => {
    return [
      {
        name: "Executions",
        success: successCount,
        failure: failureCount,
      },
    ];
  }, [successCount, failureCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Implementation & Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {action.status === "published" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                className={`flex items-center gap-1 ${implStatus.className}`}
              >
                {implStatus.icon}
                {IMPLEMENTATION_STATUS_LABELS[action.implementation_status]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {implStatus.description}
              </span>
            </div>
          </div>
        )}

        {action.status === "published" && (
          <div className="space-y-3">
            {statsLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-2 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ) : totalConfirmations > 0 ? (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.success }}
                  />
                  <span className="font-medium tabular-nums text-emerald-600">
                    {successCount.toLocaleString()}
                  </span>
                </div>

                <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide domain={[0, "dataMax"]} />
                      <YAxis type="category" dataKey="name" hide />
                      <Bar dataKey="success" stackId="a" fill={CHART_COLORS.success} />
                      <Bar dataKey="failure" stackId="a" fill={CHART_COLORS.failure} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.failure }}
                  />
                  <span className="font-medium tabular-nums text-red-600">
                    {failureCount.toLocaleString()}
                  </span>
                </div>

                <span className="text-muted-foreground">
                  ({successRate}% success)
                </span>

                {avgDuration > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {avgDuration.toLocaleString()}ms avg
                    </span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No execution confirmations recorded yet
              </p>
            )}
          </div>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Total Executions</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {action.execution_count.toLocaleString()}
            </dd>
          </div>
          {action.last_executed_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Last Executed</dt>
              <dd className="font-medium">
                {formatDistanceToNow(new Date(action.last_executed_at), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          )}
          {action.last_confirmed_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Last Confirmed</dt>
              <dd className="font-medium">
                {formatDistanceToNow(new Date(action.last_confirmed_at), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          )}
        </dl>

        <TimestampFooter
          createdAt={action.created_at}
          updatedAt={action.updated_at}
        />
      </CardContent>
    </Card>
  );
}

