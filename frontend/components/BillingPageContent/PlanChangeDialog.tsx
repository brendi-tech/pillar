"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { PlanTier } from "@/lib/billing/plans";

interface PlanChangeDialogProps {
  pendingChange: {
    tier: PlanTier;
    action: "upgrade" | "downgrade" | "cancel";
  } | null;
  currentPlan: PlanTier | undefined;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlanChangeDialog({
  pendingChange,
  currentPlan,
  isPending,
  onConfirm,
  onCancel,
}: PlanChangeDialogProps) {
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
                  {currentPlan?.priceSubtext &&
                  currentPlan.priceSubtext !== "one-time"
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
            <div className="text-right text-sm">
              <p className="font-medium text-muted-foreground">New</p>
              <p className="text-lg font-semibold">
                {tier.label}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {tier.priceLabel}
                  {tier.priceSubtext && tier.priceSubtext !== "one-time" ? "/mo" : ""}
                </span>
              </p>
            </div>
          </div>

          {!isCancel && (
            <p className="text-center text-xs text-muted-foreground">
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
