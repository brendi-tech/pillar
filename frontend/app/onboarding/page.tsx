"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { OnboardingSteps } from "@/components/Onboarding";
import { Spinner } from "@/components/ui/spinner";
import { useProduct } from "@/providers/ProductProvider";
import { knowledgeSourceListQuery } from "@/queries/sources.queries";
import { productIntegrationStatusQuery } from "@/queries/v2/products.queries";

/**
 * Derives the initial onboarding step based on user's progress.
 * - Step 3 (Test Pillar): If any integration check is true
 * - Step 2 (SDK Setup): If user has knowledge sources
 * - Step 1 (Add Knowledge): Default for new users
 */
function deriveInitialStep(
  hasSources: boolean,
  integrationStatus?: {
    sdk_initialized?: boolean;
    actions_registered?: boolean;
    action_executed?: boolean;
  }
): number {
  const hasIntegrationProgress =
    integrationStatus?.sdk_initialized ||
    integrationStatus?.actions_registered ||
    integrationStatus?.action_executed;

  if (hasIntegrationProgress) {
    return 3;
  } else if (hasSources) {
    return 2;
  }
  return 1;
}

/**
 * Inner onboarding component that uses searchParams.
 * Wrapped in Suspense boundary by the parent.
 */
function OnboardingContent() {
  const searchParams = useSearchParams();
  const isNewProduct = searchParams.get("new") === "true";

  const { currentProduct, isLoading: isProductLoading } = useProduct();
  const productId = currentProduct?.id;

  // Fetch knowledge sources (skip if creating new product or no product selected yet)
  const { data: sourcesData, isPending: isPendingSources } = useQuery({
    ...knowledgeSourceListQuery(),
    enabled: !isNewProduct && !!productId,
  });

  // Fetch integration status (skip if creating new product)
  const { data: integrationStatus, isPending: isPendingIntegration } = useQuery({
    ...productIntegrationStatusQuery(productId || ""),
    enabled: !!productId && !isNewProduct,
  });

  // Show loader while determining initial step (only for existing products)
  // Also wait for product to be selected before proceeding
  if (!isNewProduct && (isProductLoading || !productId || isPendingSources || isPendingIntegration)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  // For new products, always start at step 1
  // For existing products, derive step from their progress
  const hasSources = !!(sourcesData?.results && sourcesData.results.length > 0);
  const initialStep = isNewProduct ? 1 : deriveInitialStep(hasSources, integrationStatus);

  return (
    <OnboardingSteps
      initialStep={initialStep}
      isNewProduct={isNewProduct}
      redirectTo="/knowledge"
    />
  );
}

/**
 * Onboarding page for new users or creating additional assistants.
 * Multi-step flow: Add Knowledge -> SDK Setup -> Test Pillar
 *
 * Query params:
 * - ?new=true: Creating a new assistant (skips existing product checks)
 */
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
          <Spinner size="lg" className="text-primary" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
