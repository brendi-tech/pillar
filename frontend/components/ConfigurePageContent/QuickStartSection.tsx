'use client';

import { useState } from 'react';
import { useConfigure } from './ConfigureContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SyntaxHighlightedPre } from '@/components/mdx/SyntaxHighlightedPre';
import { 
  CheckCircle2, 
  Copy,
  ExternalLink,
  Search,
  Sparkles,
  PanelRight,
  Key,
} from 'lucide-react';
import {
  FRAMEWORKS,
  INSTALL_COMMANDS,
  getProviderCode,
  PROVIDER_LABELS,
  DOCS_URLS,
} from '@/components/InlineOnboardingSteps/InlineOnboardingSteps.constants';
import type { FrameworkId } from '@/components/InlineOnboardingSteps/InlineOnboardingSteps.types';

export function QuickStartSection() {
  const { embedConfig, helpCenterSlug } = useConfigure();
  const [copiedId, setCopiedId] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<FrameworkId>('react');

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(helpCenterSlug);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate enabled features
  const enabledFeatures = [
    embedConfig.panel.enabled && 'Help Panel',
    embedConfig.floatingButton.enabled && 'Floating Button',
    embedConfig.features.aiChatEnabled && 'AI Chat',
    embedConfig.features.searchEnabled && 'Search',
  ].filter(Boolean);

  const providerCodes = getProviderCode(helpCenterSlug);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>
              Add the Pillar SDK to your application to enable embedded help
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Ready to use
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assistant ID */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="h-4 w-4 text-muted-foreground" />
              Product Key
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-7 gap-1 text-xs"
            >
              {copiedId ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <code className="block text-sm font-mono bg-background rounded px-3 py-2 border border-border">
            {helpCenterSlug}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Use this as the <code className="bg-muted px-1 rounded">productKey</code> when initializing the SDK.
          </p>
        </div>

        {/* Installation */}
        <Tabs 
          value={selectedFramework} 
          onValueChange={(v) => setSelectedFramework(v as FrameworkId)}
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

        {/* Enabled Features Summary */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Enabled Features</div>
          <div className="flex flex-wrap gap-2">
            {enabledFeatures.length > 0 ? (
              enabledFeatures.map((feature) => (
                <Badge key={String(feature)} variant="outline" className="gap-1">
                  {feature === 'Help Panel' && <PanelRight className="h-3 w-3" />}
                  {feature === 'AI Chat' && <Sparkles className="h-3 w-3" />}
                  {feature === 'Search' && <Search className="h-3 w-3" />}
                  {feature}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No features enabled</span>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a 
              href={DOCS_URLS[selectedFramework]}
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {FRAMEWORKS.find(f => f.id === selectedFramework)?.name} Documentation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
