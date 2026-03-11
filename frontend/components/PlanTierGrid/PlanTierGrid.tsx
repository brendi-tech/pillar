"use client";

import { BillingIntervalToggle } from "@/components/BillingIntervalToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BillingInterval, PlanTier } from "@/lib/billing/plans";
import { getTierForInterval, PLAN_TIERS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

const BADGE_STYLES: Record<string, string> = {
  free: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  hobby:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  pro: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  growth: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  enterprise:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

const PLAN_ORDER = [...PLAN_TIERS.map((t) => t.name), "enterprise"];

function getButtonText(tierName: string, activePlan?: string): string {
  if (!activePlan)
    return tierName === "free" ? "Get Started Free" : "Get Started";

  if (activePlan === "enterprise") return "Contact Us";

  const activeIndex = PLAN_ORDER.indexOf(activePlan);
  const tierIndex = PLAN_ORDER.indexOf(tierName);

  if (activeIndex === -1)
    return tierName === "free" ? "Get Started Free" : "Get Started";
  if (tierIndex > activeIndex) return "Upgrade";
  return "Downgrade";
}

interface PlanTierCardProps {
  tier: PlanTier;
  interval: BillingInterval;
  onSelect: (tier: PlanTier) => void;
  disabled?: boolean;
  activePlan?: string;
}

function PlanTierCard({
  tier,
  interval,
  onSelect,
  disabled,
  activePlan,
}: PlanTierCardProps) {
  const isCurrent = activePlan === tier.name;
  const isYearly = interval === "yearly" && !!tier.yearly;
  const buttonText = getButtonText(tier.name, activePlan);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-8 transition-all",
        isCurrent
          ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/50"
          : tier.highlighted && !activePlan
            ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/50"
            : "bg-card hover:border-foreground/15 hover:shadow-sm"
      )}
    >
      {isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 text-[11px] font-medium shadow-sm">
          Current Plan
        </Badge>
      )}
      {tier.highlighted && !activePlan && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 text-[11px] font-medium shadow-sm">
          Popular
        </Badge>
      )}

      {/* Badge */}
      <div
        className={cn(
          "mb-3 inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold tracking-wider uppercase",
          BADGE_STYLES[tier.name]
        )}
      >
        {tier.badge.text}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{tier.description}</p>

      {/* Price */}
      <div className="mt-6 mb-1">
        <span className="text-5xl font-bold tracking-tight">
          {tier.priceLabel}
        </span>
        {tier.priceSubtext && (
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {tier.priceSubtext === "one-time"
              ? "one-time"
              : `/${tier.priceSubtext === "per month" ? "mo" : "yr"}`}
          </span>
        )}
      </div>

      {/* Response limit */}
      <p className="text-sm text-muted-foreground">
        {tier.responseLimit}
        {isYearly && (
          <span className="ml-1.5 text-xs text-muted-foreground/60">
            · billed yearly
          </span>
        )}
      </p>
      <div className="mt-0.5" />

      {/* CTA */}
      <div className="mt-6">
        {isCurrent ? (
          <Button
            variant="default"
            size="lg"
            className="w-full pointer-events-none"
          >
            Current Plan
          </Button>
        ) : (
          <Button
            className="w-full group"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => onSelect(tier)}
          >
            {buttonText}
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}

        {tier.ctaSubtext && !isCurrent && (
          <p className="mt-2 text-center text-xs font-medium text-muted-foreground/70">
            {tier.ctaSubtext}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mt-6 border-t pt-6 flex-1">
        <ul className="space-y-3">
          {tier.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 text-sm text-foreground/80"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// =============================================================================

export interface PlanTierGridProps {
  /** Which tiers to show */
  tiers: PlanTier[];
  /** Callback when user picks a plan */
  onSelectPlan: (tier: PlanTier) => void;
  /** Disables all CTA buttons (e.g. while checkout is loading) */
  disabled?: boolean;
  /** Currently active plan -- marks that card as "Current plan" */
  activePlan?: string;
  /** Hide the interval toggle (defaults to true / shown) */
  showIntervalToggle?: boolean;
  /** Default billing interval (defaults to "yearly") */
  defaultInterval?: BillingInterval;
}

export function PlanTierGrid({
  tiers,
  onSelectPlan,
  disabled,
  activePlan,
  showIntervalToggle = true,
  defaultInterval = "yearly",
}: PlanTierGridProps) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);

  const cols =
    tiers.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="space-y-8">
      {showIntervalToggle && (
        <div className="flex justify-center">
          <BillingIntervalToggle interval={interval} onChange={setInterval} />
        </div>
      )}
      <div className={cn("grid gap-4 items-stretch", cols)}>
        {tiers.map((tier) => {
          const adjusted = getTierForInterval(tier, interval);
          return (
            <PlanTierCard
              key={tier.name}
              tier={adjusted}
              interval={interval}
              onSelect={onSelectPlan}
              disabled={disabled}
              activePlan={activePlan}
            />
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground/60">
        Simple responses are free. Longer responses count proportionally.
      </p>
    </div>
  );
}
