'use client';

import { useState } from 'react';
import { EmbedProvider, useEmbed } from './EmbedContext';
import { EmbedOverview } from './EmbedOverview';
import { InstallSnippet } from './InstallSnippet';
import { PanelSettings } from './PanelSettings';
import { FloatingButtonSettings } from './FloatingButtonSettings';
import { EmbedFeaturesSettings } from './EmbedFeaturesSettings';
import { AllowedDomainsSettings } from './AllowedDomainsSettings';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import type { EmbedConfig } from '@/types/config';

interface EmbedPageContentProps {
  helpCenterSlug: string;
  publicKey?: string;
  initialConfig?: EmbedConfig;
  onSave?: (config: EmbedConfig) => Promise<void>;
}

function EmbedContent({ onSave }: { onSave?: (config: EmbedConfig) => Promise<void> }) {
  const { embedConfig, hasChanges, isSaving, error, setSaving, setError } = useEmbed();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await onSave(embedConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Quick Start */}
      <EmbedOverview />

      {/* Install Snippet */}
      <InstallSnippet />

      {/* Panel Settings */}
      <PanelSettings />

      {/* Floating Button */}
      <FloatingButtonSettings />

      {/* Features */}
      <EmbedFeaturesSettings />

      {/* Security / Allowed Domains */}
      <AllowedDomainsSettings />

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Save Button - Sticky Footer */}
      {hasChanges && onSave && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              You have unsaved changes
            </p>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved successfully!</span>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="min-w-32"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmbedPageContent({ 
  helpCenterSlug, 
  publicKey = '',
  initialConfig,
  onSave,
}: EmbedPageContentProps) {
  return (
    <EmbedProvider
      helpCenterSlug={helpCenterSlug}
      publicKey={publicKey}
      initialConfig={initialConfig}
    >
      <EmbedContent onSave={onSave} />
    </EmbedProvider>
  );
}

