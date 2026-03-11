"use client";

import { PlanTierGrid } from "@/components/PlanTierGrid";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanTier } from "@/lib/billing/plans";
import {
  getPlanTier,
  getTierForInterval,
  PLAN_TIERS,
} from "@/lib/billing/plans";
import { useAuth } from "@/providers/AuthProvider";
import {
  billingKeys,
  billingSubscriptionQuery,
  billingUsageQuery,
  cancelDowngradeMutation,
  cancelSubscriptionMutation,
  createCheckoutMutation,
  createPortalMutation,
  verifyCheckoutSessionMutation,
} from "@/queries/billing.queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../shared";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { BillingEmailRow } from "./BillingEmailRow";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { InvoicesCard } from "./InvoicesCard";
import { PendingDowngradeBanner } from "./PendingDowngradeBanner";
import { PlanChangeDialog } from "./PlanChangeDialog";
import { SuccessBanner } from "./SuccessBanner";
import { UsageCard } from "./UsageCard";

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="space-y-6 h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-page max-w-page mx-auto">
          <PageHeader
            title="Billing"
            description="Subscription and payment management"
          />
          {children}
        </div>
      </ScrollArea>
    </div>
  );
};

const PLAN_ORDER = PLAN_TIERS.map((t) => t.name);

function getPlanChangeAction(
  currentPlan: string | undefined,
  targetPlan: string
): "upgrade" | "downgrade" | "cancel" {
  if (targetPlan === "free") return "cancel";
  const currentIdx = currentPlan ? PLAN_ORDER.indexOf(currentPlan) : -1;
  const targetIdx = PLAN_ORDER.indexOf(targetPlan);
  return targetIdx > currentIdx ? "upgrade" : "downgrade";
}

export function BillingPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const showSuccess = searchParams.get("success") === "true";
  const sessionId = searchParams.get("session_id");
  const didVerify = useRef(false);
  const [pendingChange, setPendingChange] = useState<{
    tier: PlanTier;
    action: "upgrade" | "downgrade" | "cancel";
  } | null>(null);

  const verify = useMutation({
    ...verifyCheckoutSessionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      refreshUser();
    },
  });

  useEffect(() => {
    if (showSuccess && sessionId && !didVerify.current) {
      didVerify.current = true;
      verify.mutate({ sessionId });
    }
  }, [showSuccess, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: subscription, isPending: isSubPending } = useQuery(
    billingSubscriptionQuery()
  );
  console.log(subscription);

  const { data: usage, isPending: isUsagePending } =
    useQuery(billingUsageQuery());

  const checkout = useMutation(createCheckoutMutation());
  const cancelSub = useMutation(cancelSubscriptionMutation());
  const cancelDowngrade = useMutation(cancelDowngradeMutation());
  const portal = useMutation(createPortalMutation());

  const handleSelectPlan = (tier: PlanTier) => {
    if (subscription?.pending_downgrade) {
      toast.error("Cancel the pending downgrade before making another change");
      return;
    }
    const action = getPlanChangeAction(subscription?.plan, tier.name);
    setPendingChange({ tier, action });
  };

  const handleConfirmChange = () => {
    if (!pendingChange) return;

    const { tier, action } = pendingChange;

    if (action === "cancel") {
      cancelSub.mutate(undefined, {
        onSuccess: () => {
          setPendingChange(null);
          queryClient.invalidateQueries({ queryKey: billingKeys.all });
          refreshUser();
          toast.success(
            "Subscription will be canceled at end of billing period"
          );
        },
        onError: (error) => {
          toast.error(error.message || "Failed to cancel subscription");
        },
      });
      return;
    }

    if (!tier.stripePriceKey) return;

    checkout.mutate(
      { priceId: tier.stripePriceKey },
      {
        onSuccess: (data) => {
          setPendingChange(null);

          if (data.scheduled) {
            queryClient.invalidateQueries({ queryKey: billingKeys.all });
            const dateStr = data.effective_date
              ? new Date(data.effective_date * 1000).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }
                )
              : "end of billing period";
            toast.success(`Downgrade scheduled for ${dateStr}`);
            return;
          }

          if (data.updated) {
            queryClient.invalidateQueries({ queryKey: billingKeys.all });
            refreshUser();
            toast.success("Plan upgraded successfully");
            return;
          }

          if (data.url) {
            window.location.href = data.url;
            return;
          }

          queryClient.invalidateQueries({ queryKey: billingKeys.all });
          refreshUser();
        },
        onError: (error) => {
          toast.error(error.message || "Failed to change plan");
        },
      }
    );
  };

  const handleCancelDowngrade = () => {
    cancelDowngrade.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: billingKeys.all });
        toast.success("Scheduled downgrade canceled");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to cancel downgrade");
      },
    });
  };

  const handleManage = () => {
    portal.mutate(undefined, {
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url;
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to open billing portal");
      },
    });
  };

  if (isSubPending || isUsagePending) {
    return (
      <PageWrapper>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageWrapper>
    );
  }

  const basePlan = subscription ? getPlanTier(subscription.plan) : undefined;
  const plan =
    basePlan && subscription?.billing_interval === "yearly"
      ? getTierForInterval(basePlan, "yearly")
      : basePlan;
  const isFreePlan = subscription?.plan === "free";
  const isChangePending =
    checkout.isPending || cancelSub.isPending || cancelDowngrade.isPending;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {showSuccess && <SuccessBanner isVerifying={verify.isPending} />}

        {subscription?.pending_downgrade && (
          <PendingDowngradeBanner
            pendingDowngrade={subscription.pending_downgrade}
            currentPlan={plan}
            onCancelDowngrade={handleCancelDowngrade}
            isCancelling={cancelDowngrade.isPending}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <CurrentPlanCard
            subscription={subscription}
            plan={plan}
            isFreePlan={isFreePlan}
            isChangePending={isChangePending}
            onSelectPlan={handleSelectPlan}
            onManage={handleManage}
            isManagePending={portal.isPending}
          />
          <UsageCard usage={usage} isFreePlan={isFreePlan} />
        </div>

        <BillingEmailRow />

        <Card variant={"elevated"}>
          <CardHeader>
            <CardTitle>{isFreePlan ? "Upgrade Your Plan" : "Plans"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <PlanTierGrid
              tiers={PLAN_TIERS}
              onSelectPlan={handleSelectPlan}
              disabled={isChangePending}
              activePlan={subscription?.plan}
              defaultInterval={
                subscription?.billing_interval === "monthly"
                  ? "monthly"
                  : "yearly"
              }
            />
          </CardContent>
        </Card>

        {!isFreePlan && (
          <InvoicesCard onManage={handleManage} isPending={portal.isPending} />
        )}

        <PlanChangeDialog
          pendingChange={pendingChange}
          currentPlan={plan}
          isPending={isChangePending}
          onConfirm={handleConfirmChange}
          onCancel={() => setPendingChange(null)}
        />
      </div>
    </PageWrapper>
  );
}
