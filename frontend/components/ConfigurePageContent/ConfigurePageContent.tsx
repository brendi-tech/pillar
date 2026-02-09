"use client";

import { Button } from "@/components/ui/button";
import type { AIConfig, EmbedConfig } from "@/types/config";
import type { LanguageCode } from "@/types/v2/products";
import { Loader2, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { ActionSyncSection } from "./ActionSyncSection";
import { AIAssistantSection } from "./AIAssistantSection";
import { BrandingSection } from "./BrandingSection";
import {
  ConfigureProvider,
  useConfigure,
  type AssistantBrandingConfig,
} from "./ConfigureContext";
import { FeaturesSection } from "./FeaturesSection";
import { PanelSection } from "./PanelSection";
import { QuickStartSection } from "./QuickStartSection";
import { SecuritySection } from "./SecuritySection";

export interface ConfigureSavePayload {
  branding: AssistantBrandingConfig;
  aiConfig: AIConfig;
  embedConfig: EmbedConfig;
  defaultLanguage: LanguageCode;
  agentGuidance: string;
}

interface ConfigurePageContentProps {
  helpCenterId: string;
  helpCenterSlug: string;
  initialBranding?: AssistantBrandingConfig;
  initialAIConfig?: AIConfig;
  initialEmbedConfig?: EmbedConfig;
  initialDefaultLanguage?: LanguageCode;
  initialAgentGuidance?: string;
  onSave?: (payload: ConfigureSavePayload) => Promise<void>;
}

function ConfigureContent({
  onSave,
}: {
  onSave?: (payload: ConfigureSavePayload) => Promise<void>;
}) {
  const {
    branding,
    aiConfig,
    embedConfig,
    defaultLanguage,
    agentGuidance,
    hasChanges,
    isSaving,
    error,
    setSaving,
    setError,
    resetChanges,
    markAsSaved,
  } = useConfigure();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await onSave({
        branding,
        aiConfig,
        embedConfig,
        defaultLanguage,
        agentGuidance,
      });
      markAsSaved();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Start & Installation */}
      <QuickStartSection />

      {/* Branding */}
      <BrandingSection />

      {/* AI Assistant */}
      <AIAssistantSection />

      {/* Help Panel */}
      <PanelSection />

      {/* SDK Features */}
      <FeaturesSection />

      {/* Security / Domains */}
      <SecuritySection />

      {/* Action Sync */}
      <ActionSyncSection />

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
                <span className="text-sm text-green-600">
                  Saved successfully!
                </span>
              )}
              <Button
                variant="outline"
                onClick={resetChanges}
                disabled={isSaving}
              >
                <Undo2 className="h-4 w-4" />
                Undo Changes
              </Button>
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

export function ConfigurePageContent({
  helpCenterId,
  helpCenterSlug,
  initialBranding,
  initialAIConfig,
  initialEmbedConfig,
  initialDefaultLanguage,
  initialAgentGuidance,
  onSave,
}: ConfigurePageContentProps) {
  return (
    <ConfigureProvider
      helpCenterId={helpCenterId}
      helpCenterSlug={helpCenterSlug}
      initialBranding={initialBranding}
      initialAIConfig={initialAIConfig}
      initialEmbedConfig={initialEmbedConfig}
      initialDefaultLanguage={initialDefaultLanguage}
      initialAgentGuidance={initialAgentGuidance}
    >
      <ConfigureContent onSave={onSave} />
    </ConfigureProvider>
  );
}
