"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Mail,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  billingKeys,
  billingSubscriptionQuery,
  billingUsageQuery,
  createCheckoutMutation,
  createPortalMutation,
  verifyCheckoutSessionMutation,
} from "@/queries/billing.queries";
import { updateOrganizationMutation } from "@/queries/organization.queries";
import { getPlanTier, getPaidTiers, getTierForInterval, PLAN_TIERS } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";
import { PlanTierGrid } from "@/components/PlanTierGrid";
import { useAuth } from "@/providers/AuthProvider";
import { useOrganization } from "@/providers/OrganizationProvider";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function BillingPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const showSuccess = searchParams.get("success") === "true";
  const sessionId = searchParams.get("session_id");
  const didVerify = useRef(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

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

  const {
    data: subscription,
    isPending: isSubPending,
  } = useQuery(billingSubscriptionQuery());

  const {
    data: usage,
    isPending: isUsagePending,
  } = useQuery(billingUsageQuery());

  const checkout = useMutation(createCheckoutMutation());
  const portal = useMutation(createPortalMutation());
  const updateOrg = useMutation({
    ...updateOrganizationMutation(),
    onSuccess: () => {
      refreshUser();
      setIsEditingEmail(false);
      toast.success("Billing email updated");
    },
  });

  const handleUpgrade = (priceId: string) => {
    checkout.mutate(
      { priceId },
      {
        onSuccess: (data) => {
          window.location.href = data.url;
        },
      }
    );
  };

  const handleManage = () => {
    portal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  };

  if (isSubPending || isUsagePending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const plan = subscription ? getPlanTier(subscription.plan) : undefined;
  const isFreePlan = subscription?.plan === "free";
  const usagePercent =
    usage && usage.limit ? Math.min((usage.used / usage.limit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      {showSuccess && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            {verify.isPending ? (
              <>
                <Spinner size="sm" />
                <p className="text-sm text-muted-foreground">
                  Confirming your subscription...
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    Subscription activated
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your plan is now active. You can start using Pillar right
                    away.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl font-bold">
                {plan?.label || subscription?.plan}
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
              {plan?.ctaSubtext && plan.name !== "free"
                ? ` · ${plan.ctaSubtext}`
                : ""}
            </p>
            <div className="mt-4 flex gap-2">
              {isFreePlan ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const proTier = getPaidTiers().find(
                      (t) => t.name === "pro"
                    );
                    if (proTier) {
                      const adjusted = getTierForInterval(proTier, "yearly");
                      if (adjusted.stripePriceKey) {
                        handleUpgrade(adjusted.stripePriceKey);
                      }
                    }
                  }}
                  disabled={checkout.isPending}
                >
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  Upgrade
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManage}
                  disabled={portal.isPending}
                >
                  <CreditCard className="mr-1 h-4 w-4" />
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
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
              {isFreePlan && usage && usage.limit && usage.used >= usage.limit && (
                <p className="text-xs text-destructive">
                  Free tier exhausted. Upgrade to continue using Pillar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Email */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Billing Email</CardTitle>
          {!isEditingEmail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmailDraft(currentOrganization?.billing_email || "");
                setIsEditingEmail(true);
              }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingEmail ? (
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="billing@company.com"
                className="max-w-sm"
              />
              <Button
                size="sm"
                disabled={updateOrg.isPending}
                onClick={() => {
                  if (!currentOrganization) return;
                  updateOrg.mutate({
                    id: currentOrganization.id,
                    data: { billing_email: emailDraft || null },
                  });
                }}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingEmail(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {currentOrganization?.billing_email ? (
                <span>{currentOrganization.billing_email}</span>
              ) : (
                <span className="text-muted-foreground">
                  Not set — usage alerts will be sent to organization admins
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan tiers */}
      <div>
        <h3 className="mb-4 text-base font-semibold">
          {isFreePlan ? "Upgrade Your Plan" : "Plans"}
        </h3>
        <PlanTierGrid
          tiers={PLAN_TIERS}
          onSelectPlan={(tier: PlanTier) => {
            if (tier.stripePriceKey) {
              handleUpgrade(tier.stripePriceKey);
            }
          }}
          disabled={checkout.isPending}
          activePlan={subscription?.plan}
        />
      </div>

      {/* Invoices — link to Stripe Portal */}
      {!isFreePlan && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Invoices & Payment</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManage}
              disabled={portal.isPending}
            >
              View in Stripe
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View invoices, update payment methods, and manage your
              subscription in the Stripe Customer Portal.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
