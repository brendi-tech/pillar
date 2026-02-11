'use client';

import { useState } from 'react';
import { useEmbed } from './EmbedContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Copy, Terminal } from 'lucide-react';

export function InstallSnippet() {
  const { helpCenterSlug, embedConfig } = useEmbed();
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedNpm, setCopiedNpm] = useState(false);
  const [copiedReact, setCopiedReact] = useState(false);

  // Generate the script tag
  const scriptTag = `<script
  src="https://sdk.trypillar.com/v1/pillar.js"
  data-product-key="${helpCenterSlug}"
  async
></script>`;

  // Generate npm install command
  const npmInstall = `npm install @pillar-ai/react`;

  // Generate React code
  const reactCode = `import { PillarProvider } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider
      productKey="${helpCenterSlug}"
      config={{
        panel: {
          position: '${embedConfig.panel.position}',
          width: ${embedConfig.panel.width},
        },
      }}
    >
      <div id="app">
        {/* Your app content */}
      </div>
    </PillarProvider>
  );
}`;

  const handleCopy = async (text: string, type: 'html' | 'npm' | 'react') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'html') {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      } else if (type === 'npm') {
        setCopiedNpm(true);
        setTimeout(() => setCopiedNpm(false), 2000);
      } else {
        setCopiedReact(true);
        setTimeout(() => setCopiedReact(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Installation
        </CardTitle>
        <CardDescription>
          Choose your preferred installation method
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                onClick={() => handleCopy(scriptTag, 'html')}
              >
                {copiedHtml ? (
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
            <p className="text-xs text-muted-foreground">
              The SDK will automatically initialize and scan for tooltip attributes.
            </p>
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
                onClick={() => handleCopy(npmInstall, 'npm')}
              >
                {copiedNpm ? (
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
                onClick={() => handleCopy(reactCode, 'react')}
              >
                {copiedReact ? (
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
      </CardContent>
    </Card>
  );
}

