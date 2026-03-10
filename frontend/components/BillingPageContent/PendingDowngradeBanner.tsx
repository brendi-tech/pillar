"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ArrowDownRight } from "lucide-react";
import { getPlanTier } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";

interface PendingDowngradeInfo {
  plan: string;
  effective_date: number;
}

interface PendingDowngradeBannerProps {
  pendingDowngrade: PendingDowngradeInfo;
  currentPlan: PlanTier | undefined;
  onCancelDowngrade: () => void;
  isCancelling: boolean;
}

export function PendingDowngradeBanner({
  pendingDowngrade,
  currentPlan,
  onCancelDowngrade,
  isCancelling,
}: PendingDowngradeBannerProps) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <ArrowDownRight className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Downgrade scheduled
            </p>
            <p className="text-sm text-muted-foreground">
              Your plan will change to{" "}
              <span className="font-medium">
                {getPlanTier(pendingDowngrade.plan)?.label ?? pendingDowngrade.plan}
              </span>{" "}
              on{" "}
              {new Date(pendingDowngrade.effective_date * 1000).toLocaleDateString(
                "en-US",
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }
              )}
              . You keep {currentPlan?.label ?? "your current plan"} features until
              then.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelDowngrade}
          disabled={isCancelling}
        >
          {isCancelling ? <Spinner size="sm" /> : "Cancel Downgrade"}
        </Button>
      </CardContent>
    </Card>
  );
}
