"use client";

import { ArrowRight } from "lucide-react";

import { AIPromptBlock } from "@/components/mdx/AIPromptBlock";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  AI_PROMPT_SOURCES,
  AI_PROMPT_TITLES,
  FRAMEWORKS,
  TOOL_EXAMPLES,
} from "../InlineOnboardingSteps.constants";
import type { FrameworkId } from "../InlineOnboardingSteps.types";

interface CreateToolStepContentProps {
  onComplete: () => void;
  selectedFramework: FrameworkId;
  onFrameworkChange: (framework: FrameworkId) => void;
}

export function CreateToolStepContent({
  onComplete,
  selectedFramework,
  onFrameworkChange,
}: CreateToolStepContentProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tools let the AI assistant perform tasks in your app. Here&apos;s an
        example to get started:
      </p>

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
              className="shrink-0"
            >
              {framework.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {FRAMEWORKS.map((framework) => {
          const toolConfig = TOOL_EXAMPLES[framework.id];
          return (
            <TabsContent
              key={framework.id}
              value={framework.id}
              className="space-y-4 mt-4 min-w-0"
            >
              <SyntaxHighlightedPre
                code={toolConfig.code}
                language={toolConfig.language}
                filePath={toolConfig.filePath}
                docsUrl="https://trypillar.com/docs/guides/tools"
              />
              <AIPromptBlock
                title={AI_PROMPT_TITLES[framework.id]}
                src={AI_PROMPT_SOURCES[framework.id]}
              />
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
