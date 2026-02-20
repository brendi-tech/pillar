"use client";

import { ArrowRight } from "lucide-react";

import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  DOCS_URLS,
  FRAMEWORKS,
  getProviderCode,
  INSTALL_COMMANDS,
  PROVIDER_LABELS,
} from "../InlineOnboardingSteps.constants";
import type { FrameworkId } from "../InlineOnboardingSteps.types";

interface InstallSdkStepContentProps {
  onComplete: () => void;
  productKey: string;
  selectedFramework: FrameworkId;
  onFrameworkChange: (framework: FrameworkId) => void;
}

export function InstallSdkStepContent({
  onComplete,
  productKey,
  selectedFramework,
  onFrameworkChange,
}: InstallSdkStepContentProps) {
  const providerCodes = getProviderCode(productKey);

  return (
    <div className="space-y-5">
      <Tabs
        value={selectedFramework}
        onValueChange={(v) => onFrameworkChange(v as FrameworkId)}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FRAMEWORKS.map((framework) => (
            <TabsTrigger
              key={framework.id}
              value={framework.id}
              className="relative shrink-0 px-3 py-1.5 sm:px-4"
            >
              {framework.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {FRAMEWORKS.map((framework) => {
          const providerConfig = providerCodes[framework.id];
          return (
            <TabsContent
              key={framework.id}
              value={framework.id}
              className="space-y-4 mt-4 min-w-0"
            >
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Install packages</h4>
                <SyntaxHighlightedPre
                  code={INSTALL_COMMANDS[framework.id]}
                  language="bash"
                  docsUrl={DOCS_URLS[framework.id]}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {PROVIDER_LABELS[framework.id]}
                </h4>
                <SyntaxHighlightedPre
                  code={providerConfig.code}
                  language={providerConfig.language}
                  filePath={providerConfig.filePath}
                  docsUrl={DOCS_URLS[framework.id]}
                />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <Button size="lg" className="w-full h-11" onClick={onComplete}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
