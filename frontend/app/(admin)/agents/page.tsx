"use client";

import { AgentsPage } from "@/components/AgentsPage";
import { PageHeader } from "@/components/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers";

export default function AgentsListPage() {
  const { currentProduct, isLoading, refetchProducts } = useProduct();

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-page max-w-page mx-auto">
            <PageHeader
              title="Agents"
              description="Configure how your AI assistant behaves on each channel"
            />
            <div className="space-y-3">
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-page max-w-page mx-auto">
            <PageHeader
              title="Agents"
              description="Configure how your AI assistant behaves on each channel"
            />
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                No product selected. Please select a product first.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-page max-w-page mx-auto">
          <PageHeader
            title="Agents"
            description="Configure how your AI assistant behaves on each channel"
          />
          <AgentsPage
            productId={currentProduct.id}
            productName={currentProduct.name}
            agentGuidance={currentProduct.agent_guidance || ""}
            defaultLanguage={currentProduct.default_language || "auto"}
            onProductRefetch={refetchProducts}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
