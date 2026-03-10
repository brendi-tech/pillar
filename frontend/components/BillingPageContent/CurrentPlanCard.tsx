"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, CreditCard, Sparkles } from "lucide-react";
import { getPlanTier, getPaidTiers, getTierForInterval } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SubscriptionData {
  plan: string;
  billing_interval?: "monthly" | "yearly";
  subscription_status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  pending_downgrade?: {
    plan: string;
    effective_date: number;
  };
}

interface CurrentPlanCardProps {
  subscription: SubscriptionData | undefined;
  plan: PlanTier | undefined;
  isFreePlan: boolean;
  isChangePending: boolean;
  onSelectPlan: (tier: PlanTier) => void;
  onManage: () => void;
  isManagePending: boolean;
}

export function CurrentPlanCard({
  subscription,
  plan,
  isFreePlan,
  isChangePending,
  onSelectPlan,
  onManage,
  isManagePending,
}: CurrentPlanCardProps) {
  const handleUpgrade = () => {
    const proTier = getPaidTiers().find((t) => t.name === "pro");
    if (proTier) {
      const adjusted = getTierForInterval(proTier, "yearly");
      onSelectPlan(adjusted);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Current Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl font-bold">
            {plan?.label || subscription?.plan}
            {subscription?.billing_interval && (
              <span className="ml-1.5 text-base font-medium text-muted-foreground">
                {subscription.billing_interval === "yearly" ? "Yearly" : "Monthly"}
              </span>
            )}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1",
              subscription?.subscription_status === "active" &&
                "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            <Sparkles className="h-3 w-3" />
            {subscription?.subscription_status === "active"
              ? "Active"
              : subscription?.subscription_status}
          </Badge>
        </div>
        <div className="text-3xl font-bold">
          {plan?.priceLabel || "$0"}
          {plan?.priceSubtext && (
            <span className="text-sm font-normal text-muted-foreground">
              /{plan.priceSubtext === "per month" ? "mo" : "yr"}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan?.responseLimit}
          {plan?.ctaSubtext && plan.name !== "free" ? ` · ${plan.ctaSubtext}` : ""}
          {subscription?.billing_interval === "yearly" && (
            <span className="ml-1.5 text-xs text-muted-foreground/60">
              · billed yearly
            </span>
          )}
        </p>
        {!isFreePlan && subscription?.current_period_end && (
          <p className="mt-2 text-xs text-muted-foreground">
            {subscription.cancel_at_period_end ? (
              <>
                Cancels on{" "}
                <span className="font-medium text-foreground/70">
                  {format(
                    new Date(subscription.current_period_end * 1000),
                    "MMM d, yyyy"
                  )}
                </span>
              </>
            ) : subscription.pending_downgrade ? (
              <>
                Switches to{" "}
                <span className="font-medium text-foreground/70">
                  {getPlanTier(subscription.pending_downgrade.plan)?.label ??
                    subscription.pending_downgrade.plan}
                </span>{" "}
                on{" "}
                <span className="font-medium text-foreground/70">
                  {format(
                    new Date(subscription.pending_downgrade.effective_date * 1000),
                    "MMM d, yyyy"
                  )}
                </span>
              </>
            ) : (
              <>
                Renews{" "}
                <span className="font-medium text-foreground/70">
                  {format(
                    new Date(subscription.current_period_end * 1000),
                    "MMM d, yyyy"
                  )}
                </span>{" "}
                at {plan?.priceLabel}
                {subscription.billing_interval === "yearly"
                  ? "/mo (billed yearly)"
                  : "/mo"}
              </>
            )}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          {isFreePlan ? (
            <Button size="sm" onClick={handleUpgrade} disabled={isChangePending}>
              <ArrowUpRight className="mr-1 h-4 w-4" />
              Upgrade
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onManage}
              disabled={isManagePending}
            >
              <CreditCard className="mr-1 h-4 w-4" />
              Manage Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
