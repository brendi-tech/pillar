"use client";

import { SDKSetupStep } from "@/components/Onboarding/SDKSetupStep";
import { Spinner } from "@/components/ui/spinner";
import { useProduct } from "@/providers";
import { actionListQuery } from "@/queries/actions.queries";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Actions page - shows SDKSetupStep when no actions exist,
 * otherwise redirects to the first action.
 * The sidebar is rendered by the layout.
 */
export default function ActionsPage() {
  const { currentProduct } = useProduct();
  const router = useRouter();

  const { data, isLoading } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
    })
  );

  const actions = data?.results ?? [];

  // Redirect to first action if actions exist
  useEffect(() => {
    if (!isLoading && actions.length > 0) {
      router.replace(`/tools/${actions[0].id}`);
    }
  }, [isLoading, actions, router]);

  // Show loading spinner while loading or redirecting
  if (isLoading || actions.length > 0) {
    return (
      <div className="h-dvh grid place-items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show SDKSetupStep when no actions exist
  return (
    <div className="p-page">
      <SDKSetupStep showTestStep={true} initialSubStep={1} />
    </div>
  );
}
