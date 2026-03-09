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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CreditCard,
  Mail,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
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
import { updateOrganizationMutation } from "@/queries/organization.queries";
import { getPlanTier, getPaidTiers, getTierForInterval, PLAN_TIERS } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";
import { PlanTierGrid } from "@/components/PlanTierGrid";
import { useAuth } from "@/providers/AuthProvider";
import { useOrganization } from "@/providers/OrganizationProvider";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const { currentOrganization } = useOrganization();
  const showSuccess = searchParams.get("success") === "true";
  const sessionId = searchParams.get("session_id");
  const didVerify = useRef(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
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

  const {
    data: subscription,
    isPending: isSubPending,
  } = useQuery(billingSubscriptionQuery());

  const {
    data: usage,
    isPending: isUsagePending,
  } = useQuery(billingUsageQuery());

  const checkout = useMutation(createCheckoutMutation());
  const cancelSub = useMutation(cancelSubscriptionMutation());
  const cancelDowngrade = useMutation(cancelDowngradeMutation());
  const portal = useMutation(createPortalMutation());
  const updateOrg = useMutation({
    ...updateOrganizationMutation(),
    onSuccess: () => {
      refreshUser();
      setIsEditingEmail(false);
      toast.success("Billing email updated");
    },
  });

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
          toast.success("Subscription will be canceled at end of billing period");
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
              ? new Date(data.effective_date * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
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
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const basePlan = subscription ? getPlanTier(subscription.plan) : undefined;
  const plan =
    basePlan && subscription?.billing_interval === "yearly"
      ? getTierForInterval(basePlan, "yearly")
      : basePlan;
  const isFreePlan = subscription?.plan === "free";
  const usagePercent =
    usage && usage.limit ? Math.min((usage.used / usage.limit) * 100, 100) : 0;
  const isChangePending = checkout.isPending || cancelSub.isPending || cancelDowngrade.isPending;

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

      {subscription?.pending_downgrade && (
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
                    {getPlanTier(subscription.pending_downgrade.plan)?.label ??
                      subscription.pending_downgrade.plan}
                  </span>{" "}
                  on{" "}
                  {new Date(
                    subscription.pending_downgrade.effective_date * 1000
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  . You keep {plan?.label ?? "your current plan"} features
                  until then.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelDowngrade}
              disabled={cancelDowngrade.isPending}
            >
              {cancelDowngrade.isPending ? (
                <Spinner size="sm" />
              ) : (
                "Cancel Downgrade"
              )}
            </Button>
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
              {plan?.ctaSubtext && plan.name !== "free"
                ? ` · ${plan.ctaSubtext}`
                : ""}
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
                      {format(new Date(subscription.current_period_end * 1000), "MMM d, yyyy")}
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
                      {format(new Date(subscription.pending_downgrade.effective_date * 1000), "MMM d, yyyy")}
                    </span>
                  </>
                ) : (
                  <>
                    Renews{" "}
                    <span className="font-medium text-foreground/70">
                      {format(new Date(subscription.current_period_end * 1000), "MMM d, yyyy")}
                    </span>
                    {" "}at {plan?.priceLabel}
                    {subscription.billing_interval === "yearly" ? "/mo (billed yearly)" : "/mo"}
                  </>
                )}
              </p>
            )}
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
                      handleSelectPlan(adjusted);
                    }
                  }}
                  disabled={isChangePending}
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
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Billing Email</span>
        </div>
        {isEditingEmail ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!currentOrganization) return;
                  updateOrg.mutate({
                    id: currentOrganization.id,
                    data: { billing_email: emailDraft || null },
                  });
                }
                if (e.key === "Escape") setIsEditingEmail(false);
              }}
              placeholder="billing@company.com"
              className="h-7 w-56 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={updateOrg.isPending}
              onClick={() => {
                if (!currentOrganization) return;
                updateOrg.mutate({
                  id: currentOrganization.id,
                  data: { billing_email: emailDraft || null },
                });
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsEditingEmail(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setEmailDraft(currentOrganization?.billing_email || "");
              setIsEditingEmail(true);
            }}
          >
            <span>
              {currentOrganization?.billing_email || "Not set"}
            </span>
            <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>

      {/* Plan tiers */}
      <div>
        <h3 className="mb-4 text-base font-semibold">
          {isFreePlan ? "Upgrade Your Plan" : "Plans"}
        </h3>
        <PlanTierGrid
          tiers={PLAN_TIERS}
          onSelectPlan={handleSelectPlan}
          disabled={isChangePending}
          activePlan={subscription?.plan}
          defaultInterval={subscription?.billing_interval === "monthly" ? "monthly" : "yearly"}
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

      {/* Plan Change Confirmation Dialog */}
      <PlanChangeDialog
        pendingChange={pendingChange}
        currentPlan={plan}
        isPending={isChangePending}
        onConfirm={handleConfirmChange}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
}

function PlanChangeDialog({
  pendingChange,
  currentPlan,
  isPending,
  onConfirm,
  onCancel,
}: {
  pendingChange: { tier: PlanTier; action: "upgrade" | "downgrade" | "cancel" } | null;
  currentPlan: PlanTier | undefined;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pendingChange) return null;

  const { tier, action } = pendingChange;
  const isUpgrade = action === "upgrade";
  const isCancel = action === "cancel";

  const title = isCancel
    ? "Cancel Subscription"
    : isUpgrade
      ? `Upgrade to ${tier.label}`
      : `Downgrade to ${tier.label}`;

  const description = isCancel
    ? "Your subscription will remain active until the end of your current billing period, then revert to the Free plan."
    : isUpgrade
      ? "You'll be charged the prorated difference for the remainder of your billing period."
      : `Your plan will change to ${tier.label} at the end of your current billing period. You'll keep your current plan's features until then.`;

  return (
    <Dialog open={!!pendingChange} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="text-sm">
              <p className="font-medium text-muted-foreground">Current</p>
              <p className="text-lg font-semibold">
                {currentPlan?.label || "Free"}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {currentPlan?.priceLabel || "$0"}
                  {currentPlan?.priceSubtext && currentPlan.priceSubtext !== "one-time"
                    ? "/mo"
                    : ""}
                </span>
              </p>
            </div>
            <div className="text-muted-foreground">
              {isUpgrade ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="text-sm text-right">
              <p className="font-medium text-muted-foreground">New</p>
              <p className="text-lg font-semibold">
                {tier.label}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {tier.priceLabel}
                  {tier.priceSubtext && tier.priceSubtext !== "one-time"
                    ? "/mo"
                    : ""}
                </span>
              </p>
            </div>
          </div>

          {!isCancel && (
            <p className="text-xs text-muted-foreground text-center">
              {tier.responseLimit}
              {tier.ctaSubtext ? ` · ${tier.ctaSubtext}` : ""}
            </p>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Keep Current Plan
          </Button>
          <Button
            variant={isCancel ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Spinner size="sm" className="mr-2" />}
            {isCancel
              ? "Cancel Subscription"
              : isUpgrade
                ? "Confirm Upgrade"
                : "Confirm Downgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
