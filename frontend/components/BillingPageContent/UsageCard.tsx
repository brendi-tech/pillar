"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsageData } from "@/queries/billing.queries";
import { format, parseISO } from "date-fns";

interface UsageCardProps {
  usage: UsageData | undefined;
  isFreePlan: boolean;
}

export function UsageCard({ usage, isFreePlan }: UsageCardProps) {
  const usagePercent =
    usage && usage.limit ? Math.min((usage.used / usage.limit) * 100, 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {usage?.is_one_time ? "Lifetime Usage" : "Usage This Period"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Agent Responses</span>
            </div>
            <span className="text-muted-foreground">
              {usage?.used.toLocaleString() ?? 0}
              {usage?.limit != null
                ? ` / ${usage.limit.toLocaleString()}`
                : " (unlimited)"}
            </span>
          </div>
          {usage?.limit != null && (
            <Progress
              value={usagePercent}
              className={cn(
                "h-2",
                usagePercent >= 90 && "[&>div]:bg-amber-500",
                usagePercent >= 100 && "[&>div]:bg-destructive"
              )}
            />
          )}
          {usage?.has_payg && usage.payg_rate && (
            <p className="text-xs text-muted-foreground">
              Overage billed at ${usage.payg_rate}/response
            </p>
          )}
          {usage?.bonus_grants && usage.bonus_grants.length > 0 &&
            usage.bonus_grants.map((grant, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {grant.memo || "Bonus Responses"}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  +{grant.amount.toLocaleString()}
                  {grant.expires_at && (
                    <span className="ml-1 text-xs">
                      · expires {format(parseISO(grant.expires_at), "MMM d")}
                    </span>
                  )}
                </span>
              </div>
            ))}
          {isFreePlan && usage && usage.limit && usage.used >= usage.limit && (
            <p className="text-xs text-destructive">
              Free tier exhausted. Upgrade to continue using Pillar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
