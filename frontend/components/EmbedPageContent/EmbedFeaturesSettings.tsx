'use client';

import { useEmbed } from './EmbedContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Sparkles, 
  Search, 
  Settings2,
} from 'lucide-react';

export function EmbedFeaturesSettings() {
  const { embedConfig, updateEmbedConfig } = useEmbed();
  const features = embedConfig.features;

  const handleToggle = (key: 'aiChatEnabled' | 'searchEnabled') => {
    updateEmbedConfig({
      features: { ...features, [key]: !features[key] },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          SDK Features
        </CardTitle>
        <CardDescription>
          Control which features are available in the embedded SDK
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Chat */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <Label className="text-sm font-medium">AI Chat</Label>
              <p className="text-xs text-muted-foreground">
                Enable AI-powered chat assistance in the help panel
              </p>
            </div>
          </div>
          <Switch
            checked={features.aiChatEnabled}
            onCheckedChange={() => handleToggle('aiChatEnabled')}
          />
        </div>

        {/* Search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <Label className="text-sm font-medium">Search</Label>
              <p className="text-xs text-muted-foreground">
                Allow users to search articles from within the panel
              </p>
            </div>
          </div>
          <Switch
            checked={features.searchEnabled}
            onCheckedChange={() => handleToggle('searchEnabled')}
          />
        </div>

        {/* Info text */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p>
            Disabling a feature here will hide it from the SDK.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

