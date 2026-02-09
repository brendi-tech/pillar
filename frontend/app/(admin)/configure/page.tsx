"use client";

import { ConfigurePageContent, type ConfigureSavePayload } from "@/components/ConfigurePageContent";
import { PageHeader } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers";
import { adminPatch } from "@/lib/admin/api-client";
import type { EmbedConfig, AIConfig } from "@/types/config";
import type { AssistantBrandingConfig } from "@/components/ConfigurePageContent";
import type { LanguageCode } from "@/types/v2/products";

export default function ConfigurePage() {
  const { currentProduct, isLoading, refetchProducts } = useProduct();

  // Extract configs from help center
  const embedConfig = currentProduct?.config?.embed as EmbedConfig | undefined;
  const aiConfig = currentProduct?.config?.ai as AIConfig | undefined;
  const defaultLanguage = (currentProduct?.default_language || 'auto') as LanguageCode;
  const agentGuidance = currentProduct?.agent_guidance || '';
  
  // Extract branding (simplified)
  const branding: AssistantBrandingConfig | undefined = currentProduct?.config?.branding ? {
    name: currentProduct.config.branding.name || 'Product Assistant',
    logoUrl: currentProduct.config.branding.logoLightUrl,
    primaryColor: currentProduct.config.branding.colors?.primary,
  } : undefined;
  
  const handleSave = async (payload: ConfigureSavePayload) => {
    if (!currentProduct?.id) {
      throw new Error('No product selected');
    }

    // Transform back to the expected API format
    // Include both config updates and top-level fields like default_language and agent_guidance
    await adminPatch(`/configs/${currentProduct.id}/`, {
      default_language: payload.defaultLanguage,
      agent_guidance: payload.agentGuidance,
      config: {
        ...currentProduct.config,
        branding: {
          ...currentProduct.config?.branding,
          name: payload.branding.name,
          logoLightUrl: payload.branding.logoUrl,
          colors: {
            ...currentProduct.config?.branding?.colors,
            primary: payload.branding.primaryColor,
          },
        },
        ai: payload.aiConfig,
        embed: payload.embedConfig,
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
        description="Set up your product assistant's branding, AI behavior, and SDK settings"
      />
      <ConfigurePageContent
        helpCenterId={currentProduct.id}
        helpCenterSlug={currentProduct.subdomain || 'demo'}
        initialBranding={branding}
        initialAIConfig={aiConfig}
        initialEmbedConfig={embedConfig}
        initialDefaultLanguage={defaultLanguage}
        initialAgentGuidance={agentGuidance}
        onSave={handleSave}
      />
    </div>
  );
}
