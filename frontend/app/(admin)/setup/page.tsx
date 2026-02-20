"use client";

import { useQuery } from "@tanstack/react-query";

import { InlineOnboardingSteps } from "@/components/Onboarding";
import { PageHeader } from "@/components/shared";
import { Spinner } from "@/components/ui/spinner";
import { useProduct } from "@/providers/ProductProvider";
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

export default function SetupPage() {
  const { currentProduct, isLoading: isProductLoading } = useProduct();
  const productId = currentProduct?.id;
  const isDraft = !currentProduct?.subdomain;

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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Set Up Your Copilot"
        description="Follow the steps below to get your AI-powered copilot running."
      />
      <InlineOnboardingSteps
        initialStep={initialStep}
        redirectTo="/knowledge"
      />
    </div>
  );
}
