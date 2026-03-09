"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { PLAN_TIERS } from "@/lib/billing/plans";
import type { PlanTier } from "@/lib/billing/plans";
import { createCheckoutMutation } from "@/queries/billing.queries";
import { PlanTierGrid } from "@/components/PlanTierGrid";

export default function OnboardingPage() {
  const router = useRouter();
  const checkout = useMutation(createCheckoutMutation());

  const handleSelectPlan = (tier: PlanTier) => {
    if (tier.name === "free" || !tier.stripePriceKey) {
      router.push("/setup");
      return;
    }

    checkout.mutate(
      {
        priceId: tier.stripePriceKey,
        successUrl: `${window.location.origin}/setup?upgraded=true`,
        cancelUrl: `${window.location.origin}/onboarding`,
      },
      {
        onSuccess: (data) => {
          if (data.updated) {
            router.push("/setup?upgraded=true");
          } else if (data.url) {
            window.location.href = data.url;
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="mb-12 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Choose your plan
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Pick a plan to get started
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Start free, upgrade anytime. Only substantive AI responses count.
        </p>
      </div>

      <div className="w-full max-w-6xl">
        <PlanTierGrid
          tiers={PLAN_TIERS}
          onSelectPlan={handleSelectPlan}
          disabled={checkout.isPending}
        />
      </div>

      <button
        className="mt-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => router.push("/setup")}
      >
        Skip for now
      </button>
    </div>
  );
}
