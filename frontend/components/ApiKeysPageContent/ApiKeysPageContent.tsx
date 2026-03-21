"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers/ProductProvider";
import { useEffect, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import type { GeneratedSecret } from "./ApiKeysPageContent.types";
import { ApiUrlCollapsible } from "./ApiUrlCollapsible";
import { DocsLink } from "./DocsLink";
import { NewSecretAlert } from "./NewSecretAlert";
import { SecretsTable } from "./SecretsTable";
import { SlugDisplay } from "./SlugDisplay";
import { UsageExamples } from "./UsageExamples";

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-page max-w-page mx-auto">
        <PageHeader
          title="API Keys"
          description="Manage sync secrets for your CI/CD pipeline"
        />
        {children}
      </div>
    </div>
  );
};

export function ApiKeysPageContent() {
  const { currentProduct: config, isLoading } = useProduct();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedSecret, setGeneratedSecret] =
    useState<GeneratedSecret | null>(null);

  const handleSecretCreated = (secret: string, name: string) => {
    setGeneratedSecret({ secret, name });
  };

  useEffect(() => {
    if (generatedSecret) {
      const timer = setTimeout(
        () => {
          setGeneratedSecret(null);
        },
        5 * 60 * 1000
      );
      return () => clearTimeout(timer);
    }
  }, [generatedSecret]);

  const slug = config?.subdomain ?? "";
  const apiUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "https://help-api.trypillar.com";
  const isLocalDev = apiUrl.includes("localhost");

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <SlugDisplay slug={slug} />

        {config?.id && (
          <SecretsTable
            productId={config.id}
            onSecretCreated={handleSecretCreated}
          />
        )}

        {generatedSecret && (
          <NewSecretAlert generatedSecret={generatedSecret} />
        )}

        {isLocalDev && (
          <ApiUrlCollapsible
            apiUrl={apiUrl}
            isOpen={showAdvanced}
            onOpenChange={setShowAdvanced}
          />
        )}

        <UsageExamples
          slug={slug}
          apiUrl={apiUrl}
          isLocalDev={isLocalDev}
          generatedSecret={generatedSecret}
        />

        <DocsLink />
      </div>
    </PageWrapper>
  );
}
