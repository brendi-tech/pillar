'use client';

import { useEmbed } from './EmbedContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Copy, 
  Key, 
  ExternalLink,
  Search,
  Sparkles,
  PanelRight,
} from 'lucide-react';
import { useState } from 'react';

export function EmbedOverview() {
  const { embedConfig, helpCenterSlug, publicKey } = useEmbed();
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
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
        {/* Public Key Display */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="h-4 w-4 text-muted-foreground" />
              Public Key
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyKey}
              className="h-7 gap-1 text-xs"
            >
              {copiedKey ? (
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
            {publicKey || 'No public key generated'}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            This key is safe to include in client-side code. It identifies your product assistant.
          </p>
        </div>

        {/* Product Slug */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Assistant ID:</span>
          <code className="font-mono bg-muted px-2 py-0.5 rounded">{helpCenterSlug}</code>
        </div>

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

