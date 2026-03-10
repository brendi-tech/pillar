"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AIConfig, EmbedConfig } from "@/types/config";
import type { LanguageCode } from "@/types/v2/products";
import { Save, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "../ui/separator";
import { AIAssistantSection } from "./AIAssistantSection";
import { ConfigureProvider, useConfigure } from "./ConfigureContext";
import { SecuritySection } from "./SecuritySection";

export interface ConfigureSavePayload {
  aiConfig: AIConfig;
  embedConfig: EmbedConfig;
  defaultLanguage: LanguageCode;
  agentGuidance: string;
}

interface ConfigurePageContentProps {
  helpCenterId: string;
  helpCenterSlug: string;
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

  // Clear validation error when suggested questions are fixed
  useEffect(() => {
    if (error && error.includes("Suggested questions")) {
      const hasEmptyQuestions = aiConfig.suggestedQuestions.some((q) => {
        const text = typeof q === "string" ? q : q.text;
        return !text.trim();
      });
      if (!hasEmptyQuestions) {
        setError(null);
      }
    }
  }, [aiConfig.suggestedQuestions, error, setError]);

  const handleSave = async () => {
    if (!onSave) return;

    // Validate suggested questions - text cannot be empty
    const emptyQuestions = aiConfig.suggestedQuestions.filter((q) => {
      const text = typeof q === "string" ? q : q.text;
      return !text.trim();
    });

    if (emptyQuestions.length > 0) {
      setError(
        "Suggested questions cannot be empty. Please fill in or remove empty questions."
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await onSave({
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
      {/* AI Assistant */}
      <AIAssistantSection />
      <Separator className="mb-4" />
      {/* Security / Domains */}
      <SecuritySection />

      {/* Save Button - Sticky Footer */}
      {hasChanges && onSave && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 mb-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
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
                    <Spinner size="sm" />
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
      initialAIConfig={initialAIConfig}
      initialEmbedConfig={initialEmbedConfig}
      initialDefaultLanguage={initialDefaultLanguage}
      initialAgentGuidance={initialAgentGuidance}
    >
      <ConfigureContent onSave={onSave} />
    </ConfigureProvider>
  );
}
