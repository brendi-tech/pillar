"use client";

import { AddToolsWizard } from "@/components/AddToolsWizard";
import { PageHeader } from "@/components/shared";
import { Spinner } from "@/components/ui/spinner";
import { useProduct } from "@/providers";
import { actionListQuery } from "@/queries/actions.queries";
import { mcpSourceListQuery } from "@/queries/mcpSource.queries";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Tools page - shows AddToolsWizard when no tools exist,
 * otherwise redirects to the first tool.
 * The sidebar is rendered by the layout.
 */
export default function ToolsPage() {
  const { currentProduct } = useProduct();
  const router = useRouter();

  const { data, isLoading } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
    })
  );

  const { data: mcpSources, isLoading: isMcpLoading } = useQuery({
    ...mcpSourceListQuery(currentProduct?.id ?? ""),
    enabled: !!currentProduct?.id,
  });

  const actions = data?.results ?? [];
  const hasAnyTools = actions.length > 0 || (mcpSources && mcpSources.length > 0);
  const isLoadingAll = isLoading || isMcpLoading;

  useEffect(() => {
    if (!isLoadingAll && hasAnyTools && actions.length > 0) {
      router.replace(`/tools/${actions[0].id}`);
    }
  }, [isLoadingAll, hasAnyTools, actions, router]);

  if (isLoadingAll || (hasAnyTools && actions.length > 0)) {
    return (
      <div className="h-dvh grid place-items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-page">
      <PageHeader
        title="Add Tools"
        description="Add new tools for your AI assistant to use."
      />
      <AddToolsWizard />
    </div>
  );
}
