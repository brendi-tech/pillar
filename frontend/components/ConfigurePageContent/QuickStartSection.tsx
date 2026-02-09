'use client';

import { useState } from 'react';
import { useConfigure } from './ConfigureContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Search,
  Sparkles,
  PanelRight,
  Key,
} from 'lucide-react';

export function QuickStartSection() {
  const { embedConfig, helpCenterSlug } = useConfigure();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(helpCenterSlug);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopySnippet = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
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

  // Code snippets
  const scriptTag = `<script
  src="https://sdk.trypillar.com/v1/pillar.js"
  data-product-key="${helpCenterSlug}"
  async
></script>`;

  const npmInstall = `npm install @pillar-ai/react`;

  const reactCode = `import { PillarProvider } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider productKey="${helpCenterSlug}">
      {/* Your app content */}
    </PillarProvider>
  );
}`;

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
        <Tabs defaultValue="html" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="html">Script Tag</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
          </TabsList>

          {/* HTML Script Tag */}
          <TabsContent value="html" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Add this script tag to your HTML, just before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
                <code>{scriptTag}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1"
                onClick={() => handleCopySnippet(scriptTag, 'html')}
              >
                {copiedSnippet === 'html' ? (
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
          </TabsContent>

          {/* React */}
          <TabsContent value="react" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Install the React package:
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
                <code>{npmInstall}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1"
                onClick={() => handleCopySnippet(npmInstall, 'npm')}
              >
                {copiedSnippet === 'npm' ? (
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

            <p className="text-sm text-muted-foreground mt-4">
              Wrap your app with the provider:
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-80">
                <code>{reactCode}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1"
                onClick={() => handleCopySnippet(reactCode, 'react')}
              >
                {copiedSnippet === 'react' ? (
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
          </TabsContent>
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
              href="https://docs.trypillar.com/sdk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              SDK Documentation
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://docs.trypillar.com/sdk/react" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              React Integration
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
