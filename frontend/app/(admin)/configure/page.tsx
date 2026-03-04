"use client";

import { ConfigurePageContent, type ConfigureSavePayload } from "@/components/ConfigurePageContent";
import { PageHeader } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers";
import { adminPatch } from "@/lib/admin/api-client";
import type { EmbedConfig, AIConfig } from "@/types/config";
import type { LanguageCode } from "@/types/v2/products";

export default function ConfigurePage() {
  const { currentProduct, isLoading, refetchProducts } = useProduct();

  // Extract configs from help center
  const embedConfig = currentProduct?.config?.embed as EmbedConfig | undefined;
  const aiConfig = currentProduct?.config?.ai as AIConfig | undefined;
  const defaultLanguage = (currentProduct?.default_language || 'auto') as LanguageCode;
  const agentGuidance = currentProduct?.agent_guidance || '';
  
  const handleSave = async (payload: ConfigureSavePayload) => {
    if (!currentProduct?.id) {
      throw new Error('No product selected');
    }

    // Transform back to the expected API format
    // Include both config updates and top-level fields like default_language and agent_guidance
    // Exclude panel settings from embedConfig (managed by SDK init, not admin dashboard)
    const { panel: _panel, ...embedConfigWithoutPanel } = payload.embedConfig;
    
    await adminPatch(`/configs/${currentProduct.id}/`, {
      default_language: payload.defaultLanguage,
      agent_guidance: payload.agentGuidance,
      config: {
        ...currentProduct.config,
        ai: payload.aiConfig,
        embed: {
          ...currentProduct.config?.embed,
          ...embedConfigWithoutPanel,
        },
      },
    });
    
    // Refresh to get the updated data
    await refetchProducts();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Configure"
          description="Set up your product assistant"
        />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Configure"
          description="Set up your product assistant"
        />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            No product selected. Please select a product first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title="Configure"
        description="Set up your product assistant's AI behavior and SDK settings"
      />
      <ConfigurePageContent
        helpCenterId={currentProduct.id}
        helpCenterSlug={currentProduct.subdomain || 'demo'}
        initialAIConfig={aiConfig}
        initialEmbedConfig={embedConfig}
        initialDefaultLanguage={defaultLanguage}
        initialAgentGuidance={agentGuidance}
        onSave={handleSave}
      />
    </div>
  );
}
