"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { InlineOnboardingSteps } from "@/components/Onboarding";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getPlanTier } from "@/lib/billing/plans";
import { useAuth } from "@/providers/AuthProvider";
import { useProduct } from "@/providers/ProductProvider";
import { verifyCheckoutSessionMutation } from "@/queries/billing.queries";
import type { SubscriptionData } from "@/queries/billing.queries";
import { knowledgeSourceListQuery } from "@/queries/sources.queries";
import { productIntegrationStatusQuery } from "@/queries/v2/products.queries";

/**
 * Derives which step the user should start on based on their progress.
 *
 * Steps:
 *  1. Set Product Key (subdomain)
 *  2. Install the SDK
 *  3. Create an Action
 *  4. Sync
 *  5. Add Knowledge (optional)
 */
function deriveInitialStep(
  hasSubdomain: boolean,
  hasSources: boolean,
  integrationStatus?: {
    sdk_initialized?: boolean;
    actions_registered?: boolean;
    action_executed?: boolean;
  }
): number {
  if (!hasSubdomain) return 1;

  const sdkInit = integrationStatus?.sdk_initialized;
  const actionsReg = integrationStatus?.actions_registered;
  const actionExec = integrationStatus?.action_executed;

  if (actionExec || (actionsReg && sdkInit)) {
    return 5;
  }
  if (actionsReg) return 4;
  if (sdkInit) return 3;

  return 2;
}

function useCheckoutVerification() {
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const didVerify = useRef(false);

  const upgraded = searchParams.get("upgraded") === "true";
  const sessionId = searchParams.get("session_id");

  const verify = useMutation({
    ...verifyCheckoutSessionMutation(),
    onSuccess: () => {
      refreshUser();
    },
  });

  useEffect(() => {
    if (upgraded && sessionId && !didVerify.current) {
      didVerify.current = true;
      verify.mutate({ sessionId });
    }
  }, [upgraded, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    showUpgradeBanner: upgraded,
    isVerifying: verify.isPending,
    verifiedPlan: verify.data as SubscriptionData | undefined,
  };
}

export default function SetupPage() {
  const { currentProduct, isLoading: isProductLoading } = useProduct();
  const productId = currentProduct?.id;
  const isDraft = !currentProduct?.subdomain;

  const { showUpgradeBanner, isVerifying, verifiedPlan } =
    useCheckoutVerification();

  const { data: sourcesData, isPending: isPendingSources } = useQuery({
    ...knowledgeSourceListQuery(),
    enabled: !isDraft && !!productId,
  });

  const { data: integrationStatus, isPending: isPendingIntegration } = useQuery(
    {
      ...productIntegrationStatusQuery(productId || ""),
      enabled: !isDraft && !!productId,
    }
  );

  if (isProductLoading || (!isDraft && (!productId || isPendingSources || isPendingIntegration))) {
    return (
      <div className="h-full grid place-items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasSources = !!(sourcesData?.results && sourcesData.results.length > 0);
  const initialStep = deriveInitialStep(
    !!currentProduct?.subdomain,
    hasSources,
    integrationStatus
  );

  const planTier = verifiedPlan ? getPlanTier(verifiedPlan.plan) : null;

  return (
    <div className="space-y-6 p-6">
      {showUpgradeBanner && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            {isVerifying ? (
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
                    {planTier
                      ? `${planTier.label} plan activated`
                      : "Subscription activated"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your plan is now active. Continue setting up your copilot
                    below.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <PageHeader
        title="Set Up Your Copilot"
        description="Follow the steps below to get your AI-powered copilot running."
      />
      <InlineOnboardingSteps
        initialStep={initialStep}
        redirectTo="/tools"
      />
    </div>
  );
}
